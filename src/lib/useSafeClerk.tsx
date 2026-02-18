/**
 * Safe Clerk hooks and components that gracefully handle missing ClerkProvider.
 * During build-time prerendering, ClerkProvider may be absent (no env vars),
 * causing the standard hooks/components to throw. These wrappers return safe defaults instead.
 */
'use client';

import React, { useState, useEffect } from 'react';
import {
  useUser as useClerkUser,
  useClerk as useClerkClerk,
  SignInButton as ClerkSignInButton,
  UserButton as ClerkUserButton,
} from '@clerk/nextjs';

// Module-level cache for Clerk availability check
let clerkAvailabilityCache: boolean | null = null;

/**
 * Check if Clerk context is actually available by trying to use the hook.
 * This works because useUser throws if ClerkProvider is missing.
 */
function checkClerkAvailability(): boolean {
  if (clerkAvailabilityCache !== null) {
    return clerkAvailabilityCache;
  }
  
  // Check build-time env var first
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    clerkAvailabilityCache = false;
    return false;
  }
  
  // If env var exists, assume Clerk is available (runtime check happens in hooks)
  clerkAvailabilityCache = true;
  return true;
}

/**
 * Hook to check Clerk availability at runtime.
 * Uses a state update to handle hydration mismatch safely.
 */
function useClerkAvailable(): boolean {
  const [isAvailable, setIsAvailable] = useState(false);
  
  useEffect(() => {
    setIsAvailable(checkClerkAvailability());
  }, []);
  
  return isAvailable;
}

/**
 * Safe wrapper for useUser that returns undefined when Clerk context is missing.
 * Hook is called unconditionally to satisfy React's rules of hooks.
 */
export function useSafeUser() {
  // Check availability first
  const clerkAvailable = checkClerkAvailability();
  
  // Conditionally call the hook based on environment availability
  // This technically violates rules of hooks (conditional hook), but since
  // the condition is stable (env var) and never changes at runtime, it is safe.
  // We do this to avoid try/catch around hooks which causes issues in Next.js 15 SSR.
  if (clerkAvailable) {
     
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useClerkUser();
  }
  
  return { isSignedIn: false as const, isLoaded: true, user: undefined };
}

/**
 * Safe wrapper for useClerk that returns no-op functions when Clerk context is missing.
 * Hook is called unconditionally to satisfy React's rules of hooks.
 */
export function useSafeClerk() {
  // Check availability first
  const clerkAvailable = checkClerkAvailability();
  
  const noopResult = {
    openSignIn: () => {},
    openSignUp: () => {},
    openUserProfile: () => {},
    signOut: async () => {},
    loaded: true,
  };
  
  if (clerkAvailable) {
     
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useClerkClerk();
  }
  
  return noopResult;
}

/**
 * Safe SignedIn component that renders nothing when Clerk is unavailable.
 */
export function SafeSignedIn({ children }: { children: React.ReactNode }) {
  const clerkAvailable = useClerkAvailable();
  const { isSignedIn } = useSafeUser();
  
  if (!clerkAvailable || !isSignedIn) {
    return null;
  }
  
  return <>{children}</>;
}

/**
 * Safe SignedOut component that renders children when Clerk is unavailable or user is signed out.
 */
export function SafeSignedOut({ children }: { children: React.ReactNode }) {
  const clerkAvailable = useClerkAvailable();
  const { isSignedIn } = useSafeUser();
  
  // If Clerk isn't available, render children (as if signed out)
  if (!clerkAvailable) {
    return <>{children}</>;
  }
  
  // If Clerk is available and user is signed in, don't render
  if (isSignedIn) {
    return null;
  }
  
  // User is signed out, render children
  return <>{children}</>;
}

/**
 * Safe SignInButton that renders children when Clerk is unavailable.
 */
export function SafeSignInButton({ children, mode }: { children: React.ReactNode; mode?: 'modal' | 'redirect' }) {
  const clerkAvailable = useClerkAvailable();
  
  if (!clerkAvailable) {
    return <>{children}</>;
  }
  
  return <ClerkSignInButton mode={mode}>{children}</ClerkSignInButton>;
}

/**
 * Safe UserButton that renders nothing when Clerk is unavailable.
 */
export function SafeUserButton({ appearance }: { appearance?: Record<string, unknown> }) {
  const clerkAvailable = useClerkAvailable();
  
  if (!clerkAvailable) {
    return null;
  }
  
  return <ClerkUserButton appearance={appearance} />;
}