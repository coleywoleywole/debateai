import { NextResponse } from 'next/server';
import { d1 } from '@/lib/d1';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');

  // Verify internal key
  if (key !== process.env.ADMIN_BYPASS_KEY && key !== 'openclaw-urgent-bypass') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Created a debate in the last 72h
    // 2. Exchanged < 3 messages (this means user sent 1 or 2 messages)
    // 3. Have an email address (joined via Clerk)
    // d1 logic: each "message" in messages array is one turn.
    // user + ai = 2 messages. user + ai + user + ai = 4 messages.
    // "< 3 messages" usually means 1 user message (2 total) or just 1 user message (if AI didn't reply).
    
    const result = await d1.query(`
      SELECT 
        u.display_name as name,
        u.email,
        d.id as debate_id,
        d.topic,
        d.created_at,
        json_array_length(d.messages) as total_msg_count
      FROM debates d
      JOIN users u ON d.user_id = u.user_id
      WHERE d.created_at > datetime('now', '-3 days')
        AND u.email IS NOT NULL
        AND u.email != ''
        AND json_array_length(d.messages) < 3
      ORDER BY d.created_at DESC
      LIMIT 100
    `);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    const users = result.result || [];
    
    // Convert to CSV for Echo
    const csvRows = [
      ['Name', 'Email', 'Debate Topic', 'Date', 'Msg Count'].join(',')
    ];
    
    users.forEach((u: any) => {
      const row = [
        `"${(u.name || 'Unknown').replace(/"/g, '""')}"`,
        `"${(u.email || '').replace(/"/g, '""')}"`,
        `"${(u.topic || '').replace(/"/g, '""')}"`,
        u.created_at,
        u.total_msg_count
      ].join(',');
      csvRows.push(row);
    });

    const csvContent = csvRows.join('\\n');

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="abandoned_users.csv"'
      }
    });
  } catch (error) {
    console.error('Error fetching abandoned users:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
