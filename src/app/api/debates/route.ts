import { NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth-helper';
import { d1 } from '@/lib/d1';
import { checkAppDisabled } from '@/lib/app-disabled';
import { errors, withErrorHandler } from '@/lib/api-errors';
import { listDebatesQuerySchema } from '@/lib/api-schemas';

export const GET = withErrorHandler(async (request: Request) => {
  // Check if app is disabled
  const disabledResponse = checkAppDisabled();
  if (disabledResponse) return disabledResponse;

  const userId = await getUserId();

  if (!userId) {
    throw errors.unauthorized();
  }

  // Parse and validate query parameters
  const { searchParams } = new URL(request.url);
  const queryResult = listDebatesQuerySchema.safeParse({
    limit: searchParams.get('limit'),
    offset: searchParams.get('offset'),
  });

  if (!queryResult.success) {
    throw errors.badRequest('Invalid query parameters', {
      fields: queryResult.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
  }

  const { limit, offset } = queryResult.data;

  // Fetch debates from database
  // Using CASE WHEN json_valid to avoid SQL errors on malformed messages JSON
  const result = await d1.query(
    `SELECT 
      id,
      opponent,
      topic,
      CASE WHEN json_valid(messages) THEN json_array_length(messages) ELSE 0 END as message_count,
      created_at,
      score_data
    FROM debates 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );

  if (result.success && result.result) {
    // Format the debates for the frontend
    const debates = result.result.map((debate: Record<string, unknown>) => {
      // Try to get opponentStyle from score_data
      let opponentStyle = debate.opponent_style as string | undefined;
      
      // Fallback: Check score_data if opponent_style is missing
      if (!opponentStyle && debate.score_data) {
        try {
          const scoreData = typeof debate.score_data === 'string' 
            ? JSON.parse(debate.score_data) 
            : debate.score_data;
          
          if (scoreData && typeof scoreData === 'object') {
            opponentStyle = (scoreData as any).opponentStyle;
          }
        } catch {
          // Ignore parse errors
        }
      }

      return {
        id: String(debate.id || ''),
        opponent: String(debate.opponent || ''),
        opponentStyle: opponentStyle || 'Default',
        topic: String(debate.topic || 'Untitled Debate'),
        messageCount: Number(debate.message_count || 0),
        createdAt: String(debate.created_at || new Date().toISOString()),
      };
    });

    // Get total count for pagination
    const countResult = await d1.query(
      `SELECT COUNT(*) as total FROM debates WHERE user_id = ?`,
      [userId]
    );

    const total = (countResult.result?.[0]?.total as number) || 0;

    return NextResponse.json({
      debates,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  }

  // Log error if query failed
  if (!result.success) {
    console.error('Debates history query failed:', result.error, { userId });
  }

  return NextResponse.json({
    debates: [],
    pagination: { total: 0, limit, offset, hasMore: false },
  });
});
