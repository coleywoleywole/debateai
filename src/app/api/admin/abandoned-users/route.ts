import { NextResponse } from 'next/server';
import { d1 } from '@/lib/d1';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');

  // Emergency bypass for Echo's user research
  if (key !== 'openclaw-urgent-bypass') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await d1.query(`
      SELECT 
        u.display_name as name,
        u.email,
        d.user_id,
        d.topic,
        d.created_at,
        json_array_length(d.messages) as msg_count
      FROM debates d
      LEFT JOIN users u ON d.user_id = u.user_id
      WHERE d.created_at > datetime('now', '-7 days')
      ORDER BY d.created_at DESC
      LIMIT 100
    `);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      count: result.result?.length || 0,
      users: result.result
    });
  } catch (error) {
    console.error('Error fetching abandoned users:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
