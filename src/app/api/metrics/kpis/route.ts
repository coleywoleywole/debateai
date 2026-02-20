import { NextResponse } from 'next/server';
import { d1 } from '@/lib/d1';
import { withErrorHandler } from '@/lib/api-errors';

// KPI baselines endpoint for Feb 7 measurement
// Combines user and engagement metrics

const REAL_DEBATES = "user_id != 'test-user-123' AND json_array_length(messages) >= 2";
const REAL_USERS = "user_id != 'test-user-123'";

export const GET = withErrorHandler(async (request: Request) => {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
    const [
      // Debates
      totalDebatesResult,
      debatesTodayResult,
      debatesWeekResult,
      avgMessagesResult,
      
      // Users
      totalUsersResult,
      activeUsersTodayResult,
      activeUsersWeekResult,
      
      // Engagement
      singleExchangeResult,
      multiRoundResult,
      
      // Daily trend
      dailyTrendResult,
    ] = await Promise.all([
      d1.query(`SELECT COUNT(*) as total FROM debates WHERE ${REAL_DEBATES}`, []),
      d1.query(`SELECT COUNT(*) as total FROM debates WHERE ${REAL_DEBATES} AND created_at >= date('now')`, []),
      d1.query(`SELECT COUNT(*) as total FROM debates WHERE ${REAL_DEBATES} AND created_at >= date('now', '-7 days')`, []),
      d1.query(`SELECT AVG(json_array_length(messages)) as avg FROM debates WHERE ${REAL_DEBATES}`, []),
      
      d1.query(`SELECT COUNT(DISTINCT user_id) as total FROM debates WHERE ${REAL_USERS}`, []),
      d1.query(`SELECT COUNT(DISTINCT user_id) as total FROM debates WHERE ${REAL_USERS} AND created_at >= date('now')`, []),
      d1.query(`SELECT COUNT(DISTINCT user_id) as total FROM debates WHERE ${REAL_USERS} AND created_at >= date('now', '-7 days')`, []),
      
      d1.query(`SELECT COUNT(*) as total FROM debates WHERE ${REAL_DEBATES} AND json_array_length(messages) = 2`, []),
      d1.query(`SELECT COUNT(*) as total FROM debates WHERE ${REAL_DEBATES} AND json_array_length(messages) > 4`, []),
      
      d1.query(`
        SELECT date(created_at) as date, COUNT(*) as debates, COUNT(DISTINCT user_id) as users
        FROM debates WHERE ${REAL_DEBATES} AND created_at >= date('now', '-7 days')
        GROUP BY date(created_at) ORDER BY date ASC
      `, []),
    ]);

    const totalDebates = (totalDebatesResult.result?.[0]?.total as number) || 0;
    const debatesToday = (debatesTodayResult.result?.[0]?.total as number) || 0;
    const debatesWeek = (debatesWeekResult.result?.[0]?.total as number) || 0;
    const singleExchange = (singleExchangeResult.result?.[0]?.total as number) || 0;
    const multiRound = (multiRoundResult.result?.[0]?.total as number) || 0;

    const kpis = {
      // Core metrics
      debates: {
        total: totalDebates,
        today: debatesToday,
        last7d: debatesWeek,
        avgPerDay: Math.round((debatesWeek / 7) * 10) / 10,
      },
      
      users: {
        total: (totalUsersResult.result?.[0]?.total as number) || 0,
        activeToday: (activeUsersTodayResult.result?.[0]?.total as number) || 0,
        activeWeek: (activeUsersWeekResult.result?.[0]?.total as number) || 0,
      },
      
      engagement: {
        avgMessagesPerDebate: Math.round(((avgMessagesResult.result?.[0]?.avg as number) || 0) * 10) / 10,
        singleExchangeRate: totalDebates > 0 ? Math.round((singleExchange / totalDebates) * 1000) / 10 : 0,
        multiRoundRate: totalDebates > 0 ? Math.round((multiRound / totalDebates) * 1000) / 10 : 0,
        debateCompletionRate: totalDebates > 0 ? Math.round(((totalDebates - singleExchange) / totalDebates) * 1000) / 10 : 0,
      },
      
      // Daily trend for charts
      dailyTrend: (dailyTrendResult.result || []).map((r: Record<string, unknown>) => ({
        date: r.date as string,
        debates: (r.debates as number) || 0,
        users: (r.users as number) || 0,
      })),
      
      // Feb 7 baselines (snapshot)
      baselines: {
        date: '2026-02-07',
        avgMessagesPerDebate: 4.1,
        singleExchangeDropoff: 42.4,
        debatesPerDay: 7.7,
      },
      
      generatedAt: new Date().toISOString(),
    };

  return NextResponse.json(kpis);
});
