import { NextResponse } from 'next/server';
import { withErrorHandler, errors } from '@/lib/api-errors';
import { getLeaderboard, type LeaderboardPeriod, type LeaderboardSort } from '@/lib/streaks';

const VALID_PERIODS: LeaderboardPeriod[] = ['weekly', 'alltime'];
const VALID_SORTS: LeaderboardSort[] = ['points', 'streak', 'debates', 'avg_score'];

export const GET = withErrorHandler(async (request: Request) => {
  const { searchParams } = new URL(request.url);

  const period = (searchParams.get('period') || 'alltime') as LeaderboardPeriod;
  const sort = (searchParams.get('sort') || 'points') as LeaderboardSort;
  const limitParam = parseInt(searchParams.get('limit') || '25', 10);

  if (!VALID_PERIODS.includes(period)) {
    throw errors.badRequest(`Invalid period. Must be one of: ${VALID_PERIODS.join(', ')}`);
  }
  if (!VALID_SORTS.includes(sort)) {
    throw errors.badRequest(`Invalid sort. Must be one of: ${VALID_SORTS.join(', ')}`);
  }

  const limit = Math.min(Math.max(1, limitParam), 100);
  const entries = await getLeaderboard(period, sort, limit);

  return NextResponse.json(
    { entries, period, sort },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    },
  );
});
