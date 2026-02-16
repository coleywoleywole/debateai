'use client';

import React, { useEffect } from 'react';
import { useSafeClerk } from '@/lib/useSafeClerk';
import { track } from '@/lib/analytics';
import Link from 'next/link';

interface GuestLimitModalProps {
  isOpen: boolean;
  onClose: () => void; // Kept for interface compatibility, but not used for dismissal
  turnCount: number;
}

export default function GuestLimitModal({ isOpen, turnCount }: GuestLimitModalProps) {
  const { openSignIn } = useSafeClerk();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      track('guest_limit_modal_shown', { turnCount });
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen, turnCount]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 animate-fade-in flex items-center justify-center p-4">
      {/* Non-dismissible backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      <div className="relative z-10 w-full max-w-md bg-[var(--bg-elevated)] rounded-2xl shadow-2xl border border-[var(--border)] overflow-hidden animate-fade-scale">
        <div className="p-8 text-center space-y-6">
          {/* Icon */}
          <div className="w-16 h-16 mx-auto rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center">
             <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
             </svg>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-[var(--text)] leading-tight">
              Do not leave the debate unfinished.
            </h2>
            <p className="text-[var(--text-secondary)] text-base px-2">
              You have reached the free guest limit. Create a <span className="text-[var(--accent)] font-semibold">free</span> account to continue arguing and see who wins.
            </p>
          </div>

          <div className="space-y-4 pt-2">
            <button
              onClick={() => {
                track('guest_limit_signup_clicked', { turnCount });
                openSignIn({ afterSignInUrl: window.location.href });
              }}
              className="w-full h-12 rounded-xl bg-[var(--accent)] text-white font-semibold text-lg hover:bg-[var(--accent-hover)] hover:shadow-lg hover:shadow-[var(--accent)]/20 active:scale-[0.98] transition-all duration-200"
            >
              Continue Debate (<span className="font-bold">Free</span>)
            </button>
            
            <Link
              href="/how-it-works"
              className="block text-sm text-[var(--text-tertiary)] hover:text-[var(--text)] transition-colors underline decoration-dotted underline-offset-4"
              target="_blank"
            >
              See how scoring works
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
