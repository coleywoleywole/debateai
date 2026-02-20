import { NextResponse } from 'next/server';
import { createNotificationTables } from '@/lib/notifications';
import { withErrorHandler, errors } from '@/lib/api-errors';

/**
 * POST /api/admin/notifications/seed
 *
 * Creates the notifications and notification_preferences tables.
 * Protected by admin secret or dev mode.
 */
export const POST = withErrorHandler(async (request: Request) => {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await createNotificationTables();

  return NextResponse.json({
    success: true,
    message: 'Notification tables created successfully',
    tables: ['notifications', 'notification_preferences'],
  });
});
