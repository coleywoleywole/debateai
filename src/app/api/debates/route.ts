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
  
  // Robust parameter parsing for Zod coercion
  const rawLimit = searchParams.get('limit');
  const rawOffset = searchParams.get('offset');
  
  const queryResult = listDebatesQuerySchema.safeParse({
    limit: (rawLimit === null || rawLimit === '' || rawLimit === 'null' || rawLimit === 'undefined') 
      ? undefined 
      : rawLimit,
    offset: (rawOffset === null || rawOffset === '' || rawOffset === 'null' || rawOffset === 'undefined') 
      ? undefined 
      : rawOffset,
  });

  if (!queryResult.success) {
    throw errors.badRequest('Invalid query parameters');
  }

  const { limit, offset } = queryResult.data;

  // Fetch debates from database
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
    // Format the debates for the frontend with extreme robustness
    const debates = result.result.map((row: any) => {
      const debate = row as Record<string, any>;
      
      // 1. Extract opponentStyle safely
      let opponentStyle: string | undefined;
      if (debate.score_data) {
        try {
          const sd = typeof debate.score_data === 'string' 
            ? JSON.parse(debate.score_data) 
            : debate.score_data;
          
          if (sd && typeof sd === 'object') {
            opponentStyle = sd.opponentStyle || sd.opponent_style;
          }
        } catch { /* ignore parse errors */ }
      }

      // 2. Fallback for opponent style
      if (!opponentStyle && debate.opponent) {
        const charMap: Record<string, string> = {
          'socratic': 'The Socratic',
          'logical': 'The Logician',
          'devils_advocate': "Devil's Advocate",
          'academic': 'The Scholar',
          'pragmatist': 'The Pragmatist'
        };
        const opp = String(debate.opponent).toLowerCase();
        opponentStyle = charMap[opp] || (opp.charAt(0).toUpperCase() + opp.slice(1));
      }

      // 3. Format date robustly for cross-browser support
      let createdAt = new Date().toISOString();
      if (debate.created_at) {
        try {
          const d = new Date(debate.created_at);
          if (!isNaN(d.getTime())) {
            createdAt = d.toISOString();
          } else {
            // Try SQLite format fix
            const fixedDate = new Date(String(debate.created_at).replace(' ', 'T') + 'Z');
            if (!isNaN(fixedDate.getTime())) {
              createdAt = fixedDate.toISOString();
            } else {
              createdAt = String(debate.created_at);
            }
          }
        } catch {
          createdAt = String(debate.created_at);
        }
      }

      return {
        id: String(debate.id || ''),
        opponent: String(debate.opponent || ''),
        opponentStyle: opponentStyle || 'Default',
        topic: String(debate.topic || 'Untitled Debate'),
        messageCount: Number(debate.message_count || 0),
        createdAt,
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

  // Fallback for failed queries
  return NextResponse.json({
    debates: [],
    pagination: { total: 0, limit, offset, hasMore: false },
  });
});
