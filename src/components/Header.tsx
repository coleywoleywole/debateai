'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { SafeSignInButton, SafeUserButton, useSafeUser } from '@/lib/useSafeClerk';
import ThemeToggle from './ThemeToggle';
import UpgradeModal from './UpgradeModal';
import MobileNav from './MobileNav';
import { useSubscription } from '@/lib/useSubscription';

// Skeleton placeholder for auth loading state
function AuthSkeleton() {
  return (
    <div className="flex items-center gap-1">
      {/* Bell placeholder */}
      <div className="w-9 h-9 flex items-center justify-center">
        <div className="w-6 h-6 rounded-full bg-[var(--bg-sunken)] animate-pulse" />
      </div>
      {/* User placeholder */}
      <div className="w-8 h-8 rounded-lg bg-[var(--bg-sunken)] animate-pulse" />
    </div>
  );
}

// Skeleton placeholder for upgrade button
function UpgradeSkeleton() {
  return (
    <div className="hidden sm:block w-[100px] h-[32px] rounded-lg bg-[var(--bg-sunken)] animate-pulse ml-1" />
  );
}

export default function Header() {
  const { isPremium, isLoading: isSubscriptionLoading } = useSubscription();
  const { isSignedIn, isLoaded: isAuthLoaded } = useSafeUser();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  
  // Determine auth state for stable rendering
  const showAuthLoading = !isAuthLoaded;
  const showSignedIn = isAuthLoaded && isSignedIn;
  const showSignedOut = isAuthLoaded && !isSignedIn;

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[var(--border)]/30 bg-[var(--bg)]/50 backdrop-blur-xl">
        <div className="container-wide">
          <div className="flex items-center justify-between h-14">
            {/* Left Side: Logo & Main Navigation */}
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2.5 group cursor-pointer">
                <div className="relative w-8 h-8 rounded-lg overflow-hidden">
                  <Image 
                    src="/logo-icon.png" 
                    alt="DebateAI" 
                    width={32}
                    height={32}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    priority
                  />
                </div>
                <span className="text-[15px] font-semibold text-[var(--text)] tracking-tight">
                  DebateAI
                </span>
              </Link>
              
              <nav className="hidden sm:flex items-center gap-1">
                <Link
                  href="/explore"
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] rounded-lg hover:bg-[var(--bg-sunken)] transition-all cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                  Explore
                </Link>

                <Link
                  href="/blog"
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] rounded-lg hover:bg-[var(--bg-sunken)] transition-all cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"/>
                  </svg>
                  Blog
                </Link>
              </nav>
            </div>
            
            {/* Right Side: Auth & Settings */}
            <div className="flex items-center gap-1">
              {showSignedIn && (
                <>
                  <Link
                    href="/history"
                    className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] rounded-lg hover:bg-[var(--bg-sunken)] transition-all cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    History
                  </Link>

                  {/* Upgrade button with placeholder to prevent layout shift */}
                  {isSubscriptionLoading ? (
                    <UpgradeSkeleton />
                  ) : !isPremium ? (
                    <button
                      onClick={() => setShowUpgradeModal(true)}
                      className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[var(--accent)] bg-[var(--accent-subtle)] hover:bg-[var(--accent-faint)] rounded-lg transition-colors ml-1 cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
                      </svg>
                      Upgrade
                    </button>
                  ) : null}
                </>
              )}

              {/* Auth section - stable width container */}
              <div className="flex items-center justify-end gap-1 pl-2 ml-2 border-l border-[var(--border)] min-w-[120px]">
                {showAuthLoading ? (
                  <AuthSkeleton />
                ) : showSignedIn ? (
                  <div className="flex items-center gap-1">
                    <div className="w-8 h-8">
                      <SafeUserButton 
                        appearance={{
                          elements: {
                            avatarBox: "w-8 h-8 rounded-lg"
                          }
                        }}
                      />
                    </div>
                  </div>
                ) : showSignedOut ? (
                  <SafeSignInButton mode="modal">
                    <button className="btn btn-primary btn-sm">
                      Sign In
                    </button>
                  </SafeSignInButton>
                ) : null}
                
                <div className="hidden sm:block">
                  <ThemeToggle />
                </div>
                <MobileNav />
              </div>
            </div>
          </div>
        </div>
      </header>

      <UpgradeModal 
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        trigger="button"
      />
    </>
  );
}
