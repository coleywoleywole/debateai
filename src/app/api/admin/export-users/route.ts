import { NextResponse } from 'next/server';
import { d1 } from '@/lib/d1';

export const dynamic = 'force-dynamic';

interface UserRow {
  name: string | null;
  email: string | null;
  created_at: string | number | null; // D1 returns numbers sometimes
  debate_count: number;
}

function escapeCsv(field: string | number | null): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: Request) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Query for all users
    // Note: If user count grows significantly, we'll need to stream this or paginate.
    // For now (<10k users), fetching all is acceptable.
    const result = await d1.query(`
      SELECT 
        u.display_name as name,
        u.email,
        u.created_at,
        COUNT(d.id) as debate_count
      FROM users u
      LEFT JOIN debates d ON u.user_id = d.user_id
      WHERE u.email IS NOT NULL
      GROUP BY u.user_id
      ORDER BY u.created_at DESC
    `);

    if (!result.success) {
      console.error('D1 query failed:', result.error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const rows = (result.result || []) as unknown as UserRow[];
    
    // Convert to CSV
    const header = ['Name', 'Email', 'Date', 'Debates'];
    const csvHeader = header.join(',') + '\n';
    
    const csvRows = rows.map((r) => {
      return [
        escapeCsv(r.name || 'Anonymous'),
        escapeCsv(r.email),
        escapeCsv(r.created_at),
        escapeCsv(r.debate_count)
      ].join(',');
    }).join('\n');
    
    const csvContent = csvHeader + csvRows;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="users-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });

  } catch (error) {
    console.error('Error exporting users:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
