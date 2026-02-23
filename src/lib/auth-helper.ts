import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { verifyGuestId } from './guest-token';

/**
 * Gets the user ID, supporting test mode in development and guest users.
 * Guest IDs are HMAC-signed to prevent cookie forgery.
 */
export async function getUserId(): Promise<string | null> {
  // Dev bypass: use a real user ID for local development
  if (process.env.NODE_ENV === 'development' && process.env.DEV_USER_ID) {
    return process.env.DEV_USER_ID;
  }

  // Use real auth
  const authResult = await auth();
  if (authResult.userId) {
    return authResult.userId;
  }

  // Check for signed guest token
  try {
    const cookieStore = await cookies();
    const guestToken = cookieStore.get('guest_id')?.value;
    if (guestToken) {
      const guestId = await verifyGuestId(guestToken);
      if (guestId) {
        return `guest_${guestId}`;
      }
      // Invalid/forged token — treat as unauthenticated
    }
  } catch {
    // Ignore error if cookies() fails
  }

  return null;
}

/**
 * Gets the user ID or throws an error if not authenticated
 */
export async function requireUserId(): Promise<string> {
  const userId = await getUserId();
  
  if (!userId) {
    throw new Error('Unauthorized');
  }
  
  return userId;
}