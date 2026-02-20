'use client';

import { useState, useEffect } from 'react';
import { SafeSignedOut, SafeSignInButton } from '@/lib/useSafeClerk';
import { useUser } from '@/lib/useTestUser';
import { track } from '@/lib/analytics';
import { Zap, Search, History, X, Crown, Check } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  trigger?: 'rate-limit-debate' | 'rate-limit-message' | 'feature' | 'button';
  limitData?: { current: number; limit: number };
}

export default function UpgradeModal({ isOpen, onClose, trigger = 'button', limitData }: UpgradeModalProps) {
  const { user } = useUser();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      track('upgrade_modal_shown', { trigger: trigger === 'feature' ? 'button' : (trigger === 'rate-limit-debate' || trigger === 'rate-limit-message' ? trigger.replace('-', '_') as any : 'button') });
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen, trigger]);

  const handleUpgrade = async () => {
    track('upgrade_clicked', { source: trigger });
    try {
      setIsUpgrading(true);
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnUrl: window.location.pathname + window.location.search }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else if (data.hasSubscription) {
        alert('You already have an active subscription!');
        onClose();
      } else {
        alert(data.error || 'Failed to start checkout. Please try again.');
        setIsUpgrading(false);
      }
    } catch {
      alert('Connection error. Please check your internet and try again.');
      setIsUpgrading(false);
    }
  };

  if (!mounted || !isOpen) return null;

  const isMessageLimit = trigger === 'rate-limit-message';
  const isDebateLimit = trigger === 'rate-limit-debate';

  const features = [
    { icon: Zap, title: 'Unlimited debates & messages' },
    { icon: Search, title: 'Opponents research & cite real sources' },
    { icon: History, title: 'Full debate history' },
  ];

  return (
    <div className="fixed inset-0 z-50 animate-fade-in">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose}/>

      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div
          className="w-full max-w-md bg-[var(--bg)] rounded-2xl shadow-2xl shadow-black/20 border border-[var(--border)] overflow-hidden animate-fade-scale"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Hero Section with Gradient */}
          <div className="relative px-8 pt-8 pb-5 text-center overflow-hidden">
            {/* Gradient glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/15 via-transparent to-[var(--accent)]/5 pointer-events-none" />
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-40 h-40 bg-[var(--accent)]/25 rounded-full blur-3xl pointer-events-none" />

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full text-[var(--text-tertiary)] hover:text-[var(--text)] hover:bg-[var(--bg-sunken)] transition-all duration-200 z-10"
            >
              <X className="w-4 h-4" strokeWidth={2} />
            </button>

            {/* Premium Badge */}
            <div className="relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/30 mb-4">
              <Crown className="w-3 h-3 text-[var(--accent)]" strokeWidth={2} />
              <span className="text-[11px] font-bold text-[var(--accent)] tracking-wider uppercase">Pro</span>
            </div>

            <h2 className="relative text-[26px] font-serif font-semibold text-[var(--text)] mb-2 leading-tight">
              {isMessageLimit ? "You're out of messages" : isDebateLimit ? "You've hit the free limit" : "Go Pro"}
            </h2>
            <p className="relative text-sm text-[var(--text-secondary)] max-w-[260px] mx-auto leading-relaxed">
              {isMessageLimit
                ? `Free accounts get ${limitData?.limit || 2} messages per debate.`
                : isDebateLimit
                ? `Free accounts get ${limitData?.limit || 3} debates.`
                : "Unlimited debates, web-sourced opponents, full history."
              }
            </p>
          </div>

          {/* Features List */}
          <div className="px-8 py-4 space-y-3">
            {features.map((feature, i) => (
              <div 
                key={i} 
                className="flex items-center gap-3.5 p-2.5 -mx-2 rounded-xl hover:bg-[var(--bg-elevated)] transition-colors duration-200"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent)]/15 to-[var(--accent)]/5 text-[var(--accent)] flex items-center justify-center border border-[var(--accent)]/10">
                  <feature.icon className="w-4 h-4" strokeWidth={1.5} />
                </div>
                <span className="text-[13px] text-[var(--text)] font-medium">{feature.title}</span>
                <Check className="w-4 h-4 text-emerald-500 ml-auto flex-shrink-0" strokeWidth={2.5} />
              </div>
            ))}
          </div>

          {/* Pricing + CTA */}
          <div className="px-8 pt-2 pb-8">
            <div className="relative p-5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border)] overflow-hidden mb-5">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[var(--accent)]/60 to-transparent" />
              <div className="flex items-baseline justify-center gap-1.5">
                <span className="text-4xl font-serif font-bold text-[var(--text)] tracking-tight">$20</span>
                <span className="text-[var(--text-secondary)] text-sm">/month</span>
              </div>
              <p className="text-[11px] text-[var(--text-tertiary)] text-center mt-1.5 tracking-wide">Cancel anytime — no questions asked</p>
            </div>

            <SafeSignedOut>
              <SafeSignInButton mode="modal">
                <button className="w-full h-12 rounded-xl bg-[var(--accent)] text-white font-semibold text-[15px] flex items-center justify-center gap-2 shadow-xl shadow-[var(--accent)]/20 hover:shadow-[var(--accent)]/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200">
                  <Crown className="w-4 h-4" strokeWidth={2} />
                  Sign in to upgrade
                </button>
              </SafeSignInButton>
            </SafeSignedOut>

            {user && (
              <div className="space-y-2.5">
                <button
                  onClick={handleUpgrade}
                  disabled={isUpgrading}
                  className="w-full h-12 rounded-xl bg-[var(--accent)] text-white font-semibold text-[15px] flex items-center justify-center gap-2 shadow-xl shadow-[var(--accent)]/20 hover:shadow-[var(--accent)]/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:shadow-none"
                >
                  {isUpgrading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                      </svg>
                      Redirecting to Stripe...
                    </>
                  ) : (
                    <>
                      <Crown className="w-4 h-4" strokeWidth={2} />
                      Upgrade to Pro
                    </>
                  )}
                </button>

                <button
                  onClick={onClose}
                  className="w-full h-10 rounded-xl text-[var(--text-tertiary)] text-[13px] font-medium hover:text-[var(--text-secondary)] hover:bg-[var(--bg-sunken)] transition-all duration-200"
                >
                  Not now
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
