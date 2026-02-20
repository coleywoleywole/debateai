import { NextResponse } from 'next/server';
import { withErrorHandler, errors } from '@/lib/api-errors';
import { createStreakTables } from '@/lib/streaks';

/**
 * POST /api/admin/streaks/seed
 *
 * Creates the user_streaks and user_stats tables + indexes.
 * Admin-only — requires authenticated user.
 */
export const POST = withErrorHandler(async (request: Request) => {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    throw errors.unauthorized();
  }

  await createStreakTables();

  return NextResponse.json({ success: true, message: 'Streak tables created' });
});
