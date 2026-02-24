import { NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth-helper';
import { d1 } from '@/lib/d1';
import { withErrorHandler, errors } from '@/lib/api-errors';

// Admin user IDs — mirrors the pattern used by /api/admin/stats
const ADMIN_USER_IDS = new Set([
  process.env.ADMIN_USER_ID,
]);

/**
 * GET /api/admin/errors
 *
 * Query the error_log table. Supports:
 *   ?limit=50    — max rows to return (default 50, max 500)
 *   ?route=xxx   — filter by route (substring match)
 *   ?since=DATE  — only errors after this ISO date/datetime
 *   ?level=error — filter by level (error, warning, info, fatal)
 */
export const GET = withErrorHandler(async (request: Request) => {
  const userId = await getUserId();

  if (!userId) {
    throw errors.unauthorized();
  }

  if (!ADMIN_USER_IDS.has(userId)) {
    throw errors.forbidden('Admin access required');
  }

  const url = new URL(request.url);
  const limitParam = parseInt(url.searchParams.get('limit') || '50', 10);
  const limit = Math.min(Math.max(1, limitParam), 500);
  const route = url.searchParams.get('route');
  const since = url.searchParams.get('since');
  const level = url.searchParams.get('level');

  // Build query dynamically
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (route) {
    conditions.push('route LIKE ?');
    params.push(`%${route}%`);
  }

  if (since) {
    conditions.push('timestamp >= ?');
    params.push(since);
  }

  if (level) {
    conditions.push('level = ?');
    params.push(level);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await d1.query(
    `SELECT id, timestamp, level, route, message, stack, context, user_id, request_id
     FROM error_log
     ${whereClause}
     ORDER BY timestamp DESC
     LIMIT ?`,
    [...params, limit]
  );

  if (!result.success) {
    return NextResponse.json({ errors: [], error: result.error }, { status: 500 });
  }

  // Parse the context JSON string back into objects for a cleaner response
  const rows = (result.result || []).map((row: Record<string, unknown>) => ({
    ...row,
    context: row.context ? (() => { try { return JSON.parse(row.context as string); } catch { return row.context; } })() : null,
  }));

  return NextResponse.json({
    errors: rows,
    count: rows.length,
    filters: { limit, route, since, level },
  });
});
