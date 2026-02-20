import { NextResponse } from 'next/server';
import { d1 } from '@/lib/d1';
import { withErrorHandler } from '@/lib/api-errors';

export const GET = withErrorHandler(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

  // Fetch recent public debates
  // Note: For now, we show all debates since we don't have a 'public' flag yet.
  // We exclude debates with no scores (optional).
  const result = await d1.query(
    `SELECT
      d.id,
      d.opponent,
      d.topic,
      d.score_data,
      d.created_at,
      u.username,
      u.display_name
    FROM debates d
    LEFT JOIN users u ON d.user_id = u.user_id
    WHERE d.user_id NOT LIKE 'guest_%'
    ORDER BY d.created_at DESC
    LIMIT ?`,
    [limit]
  );

  if (!result.success || !result.result) {
    return NextResponse.json({ debates: [] });
  }

  return NextResponse.json({
    debates: result.result.map((d: any) => {
      let sd: any = null;
      if (d.score_data) {
        try { sd = typeof d.score_data === 'string' ? JSON.parse(d.score_data) : d.score_data; } catch {}
      }

      return {
        id: d.id,
        opponent: sd?.opponentStyle || d.opponent,
        topic: d.topic,
        status: sd?.debateScore ? 'completed' : 'active',
        createdAt: d.created_at,
        author: {
          username: d.username,
          displayName: d.display_name || 'Debater',
        },
      };
    })
  });
});
