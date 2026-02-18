'use client';

import { useState, useEffect, useRef } from 'react';
import { useSafeUser } from '@/lib/useSafeClerk';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Spinner from '@/components/Spinner';
import UpgradeModal from '@/components/UpgradeModal';
import OnboardingOverlay from '@/components/OnboardingOverlay';
import StreakIndicator from '@/components/StreakIndicator';
import StreakUrgencyBanner from '@/components/StreakUrgencyBanner';
import { useSubscription } from '@/lib/useSubscription';
import { markOnboarded } from '@/lib/onboarding';
import { track } from '@/lib/analytics';

const QUICK_STARTS = [
  { topic: "Free will is an illusion", persona: "Sam Harris" },
  { topic: "Social media does more harm than good", persona: "Jonathan Haidt" },
  { topic: "Privacy is a human right", persona: "Edward Snowden" },
];

interface DailyDebateData {
  topic: string;
  persona: string;
  personaId?: string | null;
  category?: string;
  description?: string;
}

export default function HomeClient({
  initialDebate,
}: {
  initialDebate: DailyDebateData;
}) {
  const router = useRouter();
  const { isSignedIn } = useSafeUser();
  const { isPremium, debatesUsed, debatesLimit } = useSubscription();
  const [dailyDebate, setDailyDebate] = useState<DailyDebateData>(initialDebate);
  const [userInput, setUserInput] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [shakeInput, setShakeInput] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Handle pending debate from sign-in redirect
  useEffect(() => {
    if (!isSignedIn || !dailyDebate) return;

    const pendingDebateStr = sessionStorage.getItem('pendingDebate');
    if (!pendingDebateStr) return;

    try {
      const pendingDebate = JSON.parse(pendingDebateStr);
      if (pendingDebate.fromLandingPage) {
        sessionStorage.removeItem('pendingDebate');
        setUserInput(pendingDebate.userInput);
        setIsStarting(true);

        const createPendingDebate = async () => {
          const debateId = crypto.randomUUID();

          try {
            const response = await fetch('/api/debate/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                character: 'custom',
                opponentStyle: pendingDebate.persona,
                topic: pendingDebate.topic,
                debateId,
              }),
            });

            if (response.ok) {
              // Backend tracks debate_created with experiment_variant - avoid duplicate tracking
              if (pendingDebate.userInput) {
                sessionStorage.setItem('firstArgument', pendingDebate.userInput);
              }
              sessionStorage.setItem('isInstantDebate', 'true');
              router.push(`/debate/${debateId}`);
            } else {
              const error = await response.json();
              if (response.status === 429 && error.error === 'debate_limit_exceeded') {
                setShowUpgradeModal(true);
              }
              setIsStarting(false);
            }
          } catch (error) {
            console.error('Error creating pending debate:', error);
            setIsStarting(false);
          }
        };

        createPendingDebate();
      }
    } catch (error) {
      console.error('Error parsing pending debate:', error);
      sessionStorage.removeItem('pendingDebate');
    }
  }, [isSignedIn, dailyDebate, router]);

  const startDebate = async (e?: React.FormEvent, textOverride?: string) => {
    if (e) e.preventDefault();
    if (!dailyDebate) return;

    const textToSubmit = textOverride || userInput.trim();

    if (!textToSubmit) {
      setShakeInput(true);
      inputRef.current?.focus();
      setTimeout(() => setShakeInput(false), 500);
      return;
    }

    // Mark onboarding complete as soon as user initiates a debate
    markOnboarded();
    track('onboarding_started', { topic: dailyDebate.topic, source: 'onboarding' });

    // Guest Mode: If not signed in, generate/use guest ID
    if (!isSignedIn) {
      let guestId = document.cookie.split('; ').find(row => row.startsWith('guest_id='))?.split('=')[1];
      if (!guestId) {
        guestId = crypto.randomUUID();
        // Set guest_id cookie for 1 year
        const expiry = new Date();
        expiry.setFullYear(expiry.getFullYear() + 1);
        document.cookie = `guest_id=${guestId}; expires=${expiry.toUTCString()}; path=/; SameSite=Lax`;
      }
    }

    setIsStarting(true);
    const debateId = crypto.randomUUID();

    try {
      const response = await fetch('/api/debate/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character: 'custom',
          opponentStyle: dailyDebate.persona,
          topic: dailyDebate.topic,
          debateId,
        }),
      });

      if (response.ok) {
        if (!isSignedIn) {
          sessionStorage.setItem('guest_debate_id', debateId);
        }
        // Backend tracks debate_created with experiment_variant - avoid duplicate tracking
        sessionStorage.setItem('firstArgument', textToSubmit);
        sessionStorage.setItem('isInstantDebate', 'true');
        router.push(`/debate/${debateId}`);
      } else {
        const error = await response.json();
        if (response.status === 429 && error.error === 'debate_limit_exceeded') {
          setShowUpgradeModal(true);
        }
        setIsStarting(false);
      }
    } catch (error) {
      console.error('Error starting debate:', error);
      setIsStarting(false);
    }
  };

  const charCount = userInput.length;
  const maxChars = 2000;

  return (
    <div className="min-h-dvh flex flex-col relative overflow-hidden">
      <Header />

      <main className="flex-1 flex flex-col items-center justify-center px-5 py-8 relative z-10">
        <div className="w-full max-w-2xl">
          {/* Hero — improved typography and spacing */}
          <div className="text-center mb-8 sm:mb-10">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mb-3">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold text-[var(--text)] leading-tight px-1">
                The AI that fights back.
              </h1>
              <StreakIndicator />
            </div>
            <p className="text-base sm:text-lg text-[var(--text-secondary)] max-w-md mx-auto">
              Defend your position. Get challenged. Think harder.
            </p>
          </div>

          {/* Streak urgency banner */}
          <StreakUrgencyBanner />

          {/* Today's Debate Card — enhanced styling */}
          <div className="mb-6 animate-fade-up" style={{ animationDelay: '100ms' }} data-onboarding="topic">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 sm:p-6 shadow-sm">
              {/* Topic label with shuffle button */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 flex-1">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--accent)]">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Today&apos;s Debate
                  </span>
                  <span className="h-px flex-1 bg-[var(--border)]" />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const others = QUICK_STARTS.filter(q => q.topic !== dailyDebate.topic);
                    const random = others[Math.floor(Math.random() * others.length)];
                    setDailyDebate({
                      topic: random.topic,
                      persona: random.persona,
                    });
                    track('topic_shuffled', { newTopic: random.topic });
                  }}
                  className="ml-3 p-2 rounded-lg border border-[var(--border)] hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5 text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-all group"
                  title="Shuffle to a different topic"
                >
                  <svg className="w-4 h-4 group-active:rotate-180 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>

              {/* Topic — improved typography */}
              <h2 className="text-xl sm:text-2xl font-serif font-semibold text-[var(--text)] mb-4 leading-snug">
                {dailyDebate.topic}
              </h2>

              {/* Opponent — enhanced styling */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-sunken)]/50 border border-[var(--border)]/50">
                <div className="w-10 h-10 rounded-full bg-[var(--accent)]/15 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text)]">
                    You&apos;re debating <strong className="font-semibold text-[var(--accent)]">{dailyDebate.persona}</strong>
                  </p>
                  {dailyDebate.description && (
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
                      {dailyDebate.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Argument Input — enhanced styling */}
          <form onSubmit={startDebate} className="animate-fade-up" style={{ animationDelay: '200ms' }}>
            <div
              data-onboarding="input"
              className={`
                rounded-2xl bg-[var(--bg-elevated)] transition-all duration-200 border
                ${shakeInput
                  ? 'animate-shake border-[var(--error)] ring-2 ring-[var(--error)]/20'
                  : isFocused
                    ? 'border-[var(--accent)]/50 ring-1 ring-[var(--accent)]/20 shadow-md'
                    : 'border-[var(--border)] hover:border-[var(--border-strong)]'
                }
              `}
            >
              <div className="p-5">
                <label htmlFor="argument-input" className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)] mb-3">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  What&apos;s your opening argument?
                </label>
                <textarea
                  id="argument-input"
                  ref={inputRef}
                  value={userInput}
                  onChange={(e) => {
                    if (e.target.value.length <= maxChars) {
                      setUserInput(e.target.value);
                    }
                  }}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isStarting) {
                      startDebate();
                    }
                  }}
                  placeholder="Type your opening argument here to begin..."
                  className="w-full bg-transparent resize-none outline-none text-[var(--text)] placeholder-[var(--text-secondary)]/60 min-h-[100px] text-base sm:text-[15px] leading-relaxed"
                  disabled={isStarting}
                  autoFocus
                />

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--border)]/50">
                  <span
                    className={`text-xs tabular-nums transition-colors ${
                      charCount > maxChars * 0.9
                        ? 'text-[var(--error)] font-medium'
                        : 'text-[var(--text-tertiary)]'
                    }`}
                  >
                    {charCount > 0 ? `${charCount} / ${maxChars}` : '\u00A0'}
                  </span>

                  <span className="hidden sm:flex items-center gap-1 text-xs text-[var(--text-tertiary)] cursor-default select-none">
                    <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-sunken)] border border-[var(--border)] text-[10px] font-mono">
                      ⌘
                    </kbd>
                    <span>+</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-sunken)] border border-[var(--border)] text-[10px] font-mono">
                      Enter
                    </kbd>
                    <span className="ml-1">to start</span>
                  </span>
                </div>
              </div>
            </div>

            {/* CTA Row — improved button styling */}
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <button
                type="submit"
                disabled={isStarting}
                data-onboarding="cta"
                className={`
                  flex-1 h-12 px-6 rounded-xl font-medium text-base transition-all duration-200
                  flex items-center justify-center gap-2
                  ${!isStarting
                    ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/30 hover:shadow-xl hover:shadow-[var(--accent)]/40 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md cursor-pointer'
                    : 'bg-[var(--bg-sunken)] text-[var(--text-secondary)] cursor-not-allowed'
                  }
                `}
              >
                {isStarting ? (
                  <>
                    <Spinner className="h-4 w-4" />
                    <span>Starting…</span>
                  </>
                ) : (
                  <>
                    <span>Start Debate</span>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isStarting}
                onClick={() => startDebate(undefined, "AI, you start the debate. Make your opening argument.")}
                className="h-12 px-5 rounded-xl font-medium text-[15px] border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text)] hover:bg-[var(--bg-sunken)] hover:border-[var(--border-strong)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
              >
                <svg className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>AI goes first</span>
              </button>
            </div>

            {/* Sign-in hint */}
            {!isSignedIn && (
              <p className="text-center text-xs text-[var(--text-secondary)] mt-3">
                Start immediately — no account needed
              </p>
            )}
          </form>

          {/* Quick Start Options — improved card styling */}
          <div className="mt-10 animate-fade-in" style={{ animationDelay: '300ms' }}>
            <div className="flex items-center gap-4 mb-4">
              <div className="h-px flex-1 bg-[var(--border)]" />
              <p className="text-xs text-center text-[var(--text-secondary)] uppercase tracking-wider font-semibold">
                Or try a different topic
              </p>
              <div className="h-px flex-1 bg-[var(--border)]" />
            </div>
            <div className="grid gap-3">
              {QUICK_STARTS.map((option, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setDailyDebate({
                      topic: option.topic,
                      persona: option.persona,
                    });
                    // Focus input and bring it into view so user can start typing immediately
                    if (inputRef.current) {
                      inputRef.current.focus();
                      inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                  }}
                  className="group flex items-center justify-between p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5 transition-all text-left w-full cursor-pointer shadow-sm hover:shadow-md"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
                      {option.topic}
                    </span>
                    <span className="text-xs text-[var(--text-secondary)]">
                      vs. {option.persona}
                    </span>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-[var(--bg-sunken)] group-hover:bg-[var(--accent)]/10 flex items-center justify-center transition-colors">
                    <svg className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-all transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Upgrade Nudge */}
          {!isPremium && debatesUsed !== undefined && debatesUsed >= 2 && (
            <div className="mt-10 text-center animate-fade-in">
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-medium text-[var(--accent)] bg-[var(--accent)]/5 border border-[var(--accent)]/20 hover:bg-[var(--accent)]/10 hover:scale-105 transition-all cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>
                  {debatesLimit && debatesUsed >= debatesLimit
                    ? 'Limit reached — Upgrade'
                    : `${debatesLimit ? debatesLimit - debatesUsed : 0} debates left — Upgrade`}
                </span>
              </button>
            </div>
          )}
        </div>
      </main>

      {/* First-time user onboarding */}
      <OnboardingOverlay />

      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} trigger="button" />
    </div>
  );
}
