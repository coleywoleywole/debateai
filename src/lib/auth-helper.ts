import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';

/**
 * Gets the user ID, supporting test mode in development and guest users
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

  // Check for guest user
  try {
    const cookieStore = await cookies();
    const guestId = cookieStore.get('guest_id')?.value;
    if (guestId) {
      return `guest_${guestId}`;
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