import { NextResponse } from 'next/server';
import { d1 } from '@/lib/d1';
import { withErrorHandler, errors } from '@/lib/api-errors';

type SortOption = 'recent' | 'top_scored' | 'most_messages';

const VALID_SORTS: SortOption[] = ['recent', 'top_scored', 'most_messages'];

/**
 * GET /api/explore/debates
 *
 * Public paginated feed of scored debates.
 */
export const GET = withErrorHandler(async (request: Request) => {
  const { searchParams } = new URL(request.url);

  const sort = (searchParams.get('sort') || 'recent') as SortOption;
  const limitParam = parseInt(searchParams.get('limit') || '20', 10);
  const offsetParam = parseInt(searchParams.get('offset') || '0', 10);
  const category = searchParams.get('category') || null;

  if (!VALID_SORTS.includes(sort)) {
    throw errors.badRequest(`Invalid sort. Must be one of: ${VALID_SORTS.join(', ')}`);
  }

  const limit = Math.min(Math.max(1, limitParam), 50);
  const offset = Math.max(0, offsetParam);

  // Build ORDER BY
  let orderBy: string;
  switch (sort) {
    case 'top_scored':
      orderBy = 'user_score DESC';
      break;
    case 'most_messages':
      orderBy = 'json_array_length(messages) DESC';
      break;
    case 'recent':
    default:
      orderBy = 'created_at DESC';
  }

  // Only show debates that have been scored
  let whereClause = "score_data IS NOT NULL AND score_data != 'null' AND json_extract(score_data, '$.debateScore') IS NOT NULL";
  const params: unknown[] = [];

  if (category) {
    whereClause += ' AND topic LIKE ?';
    params.push(`%${category}%`);
  }

  // Fetch debates
  const result = await d1.query(
    `SELECT
       id,
       topic,
       opponent,
       messages,
       user_score,
       ai_score,
       score_data,
       created_at
     FROM debates
     WHERE ${whereClause}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  // Get total count for pagination
  const countResult = await d1.query(
    `SELECT COUNT(*) as total FROM debates WHERE ${whereClause}`,
    params,
  );

  const total = (countResult.result?.[0]?.total as number) || 0;

  if (!result.success || !result.result) {
    return NextResponse.json({
      debates: [],
      pagination: { total: 0, limit, offset, hasMore: false },
    });
  }

  const debates = result.result.map((row) => {
    const r = row as Record<string, unknown>;

    let messageCount = 0;
    let previewMessage = '';
    try {
      const msgs = typeof r.messages === 'string' ? JSON.parse(r.messages) : r.messages;
      if (Array.isArray(msgs)) {
        const contentMsgs = msgs.filter(
          (m: { role: string; content: string }) => m.role === 'user' || m.role === 'ai',
        );
        messageCount = contentMsgs.length;
        const firstUser = contentMsgs.find((m: { role: string }) => m.role === 'user');
        if (firstUser) {
          previewMessage =
            firstUser.content.length > 150
              ? firstUser.content.slice(0, 150) + '…'
              : firstUser.content;
        }
      }
    } catch {
      // Ignore
    }

    let winner: string | null = null;
    let summary: string | null = null;
    try {
      const sd = typeof r.score_data === 'string' ? JSON.parse(r.score_data) : r.score_data;
      if (sd?.debateScore) {
        winner = sd.debateScore.winner;
        summary = sd.debateScore.summary;
      }
    } catch {
      // Ignore
    }

    return {
      id: r.id,
      topic: r.topic,
      opponent: r.opponent,
      messageCount,
      previewMessage,
      userScore: r.user_score,
      aiScore: r.ai_score,
      winner,
      summary,
      createdAt: r.created_at,
    };
  });

  return NextResponse.json(
    {
      debates,
      pagination: { total, limit, offset, hasMore: offset + limit < total },
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    },
  );
});
