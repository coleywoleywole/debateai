/**
 * POST /api/admin/email/seed
 *
 * Creates the email_preferences table and optionally seeds
 * preferences for all existing users with emails.
 */

import { NextResponse } from 'next/server';
import { createEmailPreferencesTables, getOrCreatePreferences } from '@/lib/email-preferences';
import { d1 } from '@/lib/d1';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Create tables
    await createEmailPreferencesTables();

    // 2. Seed preferences for existing users with emails
    const usersResult = await d1.query(
      "SELECT user_id, email FROM users WHERE email IS NOT NULL AND email != ''",
    );

    let seeded = 0;
    if (usersResult.success && usersResult.result) {
      for (const row of usersResult.result) {
        const user = row as Record<string, unknown>;
        try {
          await getOrCreatePreferences(user.user_id as string, user.email as string);
          seeded++;
        } catch {
          // Skip duplicates
        }
      }
    }

    return NextResponse.json({
      message: 'Email preferences tables created and seeded',
      seeded,
    });
  } catch (error) {
    console.error('Email seed error:', error);
    return NextResponse.json({ error: 'Failed to seed email preferences' }, { status: 500 });
  }
}
