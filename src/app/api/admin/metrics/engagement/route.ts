import { NextResponse } from 'next/server';
import { d1 } from '@/lib/d1';
import { withErrorHandler } from '@/lib/api-errors';

// Engagement metrics endpoint - Secured for Admin use

const REAL_DEBATES_BASE = "user_id != 'test-user-123'";

export const GET = withErrorHandler(async (request: Request) => {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

    // Run all engagement queries in parallel
    const [
      totalDebatesResult,
      singleExchangeResult,
      avgMessagesResult,
      continuedDebatesResult,
      // Also get time-based breakdown
      last24hResult,
      last7dResult,
    ] = await Promise.all([
      // Total debates with at least one exchange (2+ messages)
      d1.query(
        `SELECT COUNT(*) as total FROM debates WHERE ${REAL_DEBATES_BASE} AND json_array_length(messages) >= 2`,
        []
      ),
      
      // Single-exchange debates (exactly 2 messages: 1 user + 1 AI response)
      d1.query(
        `SELECT COUNT(*) as total FROM debates WHERE ${REAL_DEBATES_BASE} AND json_array_length(messages) = 2`,
        []
      ),
      
      // Average messages per debate
      d1.query(
        `SELECT AVG(json_array_length(messages)) as avg_msgs FROM debates WHERE ${REAL_DEBATES_BASE} AND json_array_length(messages) >= 2`,
        []
      ),
      
      // Debates with continuation (user came back for more - 3+ messages)
      d1.query(
        `SELECT COUNT(*) as total FROM debates WHERE ${REAL_DEBATES_BASE} AND json_array_length(messages) > 2`,
        []
      ),
      
      // Last 24 hours breakdown
      d1.query(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN json_array_length(messages) = 2 THEN 1 ELSE 0 END) as single_exchange,
          AVG(json_array_length(messages)) as avg_msgs
        FROM debates 
        WHERE ${REAL_DEBATES_BASE} AND created_at >= datetime('now', '-1 day') AND json_array_length(messages) >= 2`,
        []
      ),
      
      // Last 7 days breakdown (post-fix period)
      d1.query(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN json_array_length(messages) = 2 THEN 1 ELSE 0 END) as single_exchange,
          AVG(json_array_length(messages)) as avg_msgs
        FROM debates 
        WHERE ${REAL_DEBATES_BASE} AND created_at >= datetime('now', '-7 days') AND json_array_length(messages) >= 2`,
        []
      ),
    ]);

    const totalDebates = (totalDebatesResult.result?.[0]?.total as number) || 0;
    const singleExchange = (singleExchangeResult.result?.[0]?.total as number) || 0;
    const continuedDebates = (continuedDebatesResult.result?.[0]?.total as number) || 0;
    const avgMessages = (avgMessagesResult.result?.[0]?.avg_msgs as number) || 0;

    // Last 24h
    const last24h = last24hResult.result?.[0] || {};
    const last24hTotal = (last24h.total as number) || 0;
    const last24hSingle = (last24h.single_exchange as number) || 0;
    
    // Last 7d
    const last7d = last7dResult.result?.[0] || {};
    const last7dTotal = (last7d.total as number) || 0;
    const last7dSingle = (last7d.single_exchange as number) || 0;

    const metrics = {
      // All-time metrics
      allTime: {
        totalDebates,
        singleExchangeDebates: singleExchange,
        singleExchangeDropoffRate: totalDebates > 0 
          ? Math.round((singleExchange / totalDebates) * 1000) / 10 
          : 0,
        continuedDebates,
        firstExchangeRetention: totalDebates > 0 
          ? Math.round((continuedDebates / totalDebates) * 1000) / 10 
          : 0,
        avgMessagesPerDebate: Math.round(avgMessages * 10) / 10,
      },
      
      // Last 24 hours (most recent data)
      last24h: {
        totalDebates: last24hTotal,
        singleExchangeDropoffRate: last24hTotal > 0 
          ? Math.round((last24hSingle / last24hTotal) * 1000) / 10 
          : 0,
        firstExchangeRetention: last24hTotal > 0 
          ? Math.round(((last24hTotal - last24hSingle) / last24hTotal) * 1000) / 10 
          : 0,
        avgMessagesPerDebate: Math.round(((last24h.avg_msgs as number) || 0) * 10) / 10,
      },
      
      // Last 7 days (post-fix period)
      last7d: {
        totalDebates: last7dTotal,
        singleExchangeDropoffRate: last7dTotal > 0 
          ? Math.round((last7dSingle / last7dTotal) * 1000) / 10 
          : 0,
        firstExchangeRetention: last7dTotal > 0 
          ? Math.round(((last7dTotal - last7dSingle) / last7dTotal) * 1000) / 10 
          : 0,
        avgMessagesPerDebate: Math.round(((last7d.avg_msgs as number) || 0) * 10) / 10,
      },
      
      // Baselines for comparison
      baselines: {
        singleExchangeDropoffRate: 42.4,
        avgMessagesPerDebate: 4.1,
        firstExchangeRetention: null, // New metric, no baseline
      },
      
      generatedAt: new Date().toISOString(),
    };

  return NextResponse.json(metrics);
});
