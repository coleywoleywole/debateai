import { NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth-helper';
import { errors, withErrorHandler } from '@/lib/api-errors';
import { getNotifications } from '@/lib/notifications';
import { ensureWelcomeEmail } from '@/lib/email-preferences';

/**
 * GET /api/notifications
 *
 * Returns the authenticated user's recent notifications + unread count.
 * Query params: limit (default 20), offset (default 0).
 */
export const GET = withErrorHandler(async (request: Request) => {
  const userId = await getUserId();
  if (!userId) {
    throw errors.unauthorized();
  }

  // Lazy-trigger welcome email for new users
  // (Fire and forget to not block notification delivery)
  ensureWelcomeEmail(userId).catch(console.error);

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50);
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);

  const result = await getNotifications(userId, limit, offset);

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'no-store' },
  });
});
