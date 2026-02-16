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
  
  // Robust parameter parsing: handle null, undefined, "", and string "null"/"undefined"
  const rawLimit = searchParams.get('limit');
  const rawOffset = searchParams.get('offset');
  
  const cleanLimit = (rawLimit === null || rawLimit === '' || rawLimit === 'null' || rawLimit === 'undefined') 
    ? undefined 
    : rawLimit;
  const cleanOffset = (rawOffset === null || rawOffset === '' || rawOffset === 'null' || rawOffset === 'undefined') 
    ? undefined 
    : rawOffset;

  const queryResult = listDebatesQuerySchema.safeParse({
    limit: cleanLimit,
    offset: cleanOffset,
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
  // Using CASE WHEN json_valid and json_type to avoid SQL errors on malformed messages JSON
  const result = await d1.query(
    `SELECT 
      id,
      opponent,
      topic,
      CASE 
        WHEN json_valid(messages) AND json_type(messages) = 'array' 
        THEN json_array_length(messages) 
        ELSE 0 
      END as message_count,
      created_at,
      score_data
    FROM debates 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );

  if (result.success && result.result) {
    // Log for debugging (only in development or if results are unexpected)
    if (result.result.length === 0) {
      console.log(`No debates found for user: ${userId}`);
    }

    // Format the debates for the frontend
    const debates = result.result.map((debate: Record<string, any>) => {
      // Extract opponentStyle from score_data
      let opponentStyle: string | undefined;
      
      if (debate.score_data) {
        try {
          const scoreData = typeof debate.score_data === 'string' 
            ? JSON.parse(debate.score_data) 
            : debate.score_data;
          
          if (scoreData && typeof scoreData === 'object') {
            opponentStyle = scoreData.opponentStyle || scoreData.opponent_style;
          }
        } catch {
          // Ignore parse errors, fallback to default
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

    const total = Number(countResult.result?.[0]?.total || 0);

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
