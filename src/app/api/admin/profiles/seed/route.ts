import { NextResponse } from 'next/server';
import { withErrorHandler, errors } from '@/lib/api-errors';
import { createProfileTables } from '@/lib/profiles';

/**
 * POST /api/admin/profiles/seed
 *
 * Creates the user_profiles table + indexes.
 */
export const POST = withErrorHandler(async (request: Request) => {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    throw errors.unauthorized();
  }

  await createProfileTables();

  return NextResponse.json({ success: true, message: 'Profile tables created' });
});
