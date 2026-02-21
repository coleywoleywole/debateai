import { NextResponse } from 'next/server';
import { d1 } from './d1';

/**
 * Verify that a cron request has a valid Bearer token matching CRON_SECRET.
 * Returns null if valid, or a 401 NextResponse if unauthorized.
 */
export function verifyCronSecret(request: Request): NextResponse | null {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

/**
 * Get the most-debated topic from the last 7 days.
 * Returns the topic string and debate count, or null if no debates found.
 */
export async function getTrendingTopic(): Promise<{ topic: string; count: number } | null> {
  const result = await d1.query(
    `SELECT topic, COUNT(*) as count FROM debates
     WHERE created_at >= date('now', '-7 days')
     GROUP BY topic ORDER BY count DESC LIMIT 1`
  );

  if (!result.success || !result.result || result.result.length === 0) {
    return null;
  }

  const row = result.result[0] as { topic: string; count: number };
  return { topic: row.topic, count: row.count };
}
