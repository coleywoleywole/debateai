'use client';

import { useState, useEffect, useRef } from 'react';
import { useSafeUser } from '@/lib/useSafeClerk';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import StreakUrgencyBanner from '@/components/StreakUrgencyBanner';
import Spinner from '@/components/Spinner';
import UpgradeModal from '@/components/UpgradeModal';
import OnboardingOverlay from '@/components/OnboardingOverlay';
import { useSubscription } from '@/lib/useSubscription';
import { markOnboarded } from '@/lib/onboarding';
import { track } from '@/lib/analytics';
import { v4 as uuidv4 } from 'uuid';

interface DailyDebateData {
  topic: string;
  persona: string;
  personaId?: string | null;
  category?: string;
  description?: string;
}

export default function HomeClient({
  initialDebate,
  quickStarts,
}: {
  initialDebate: DailyDebateData;
  quickStarts: DailyDebateData[];
}) {
  const router = useRouter();
  const { isSignedIn } = useSafeUser();
  const { isPremium, debatesUsed, debatesLimit } = useSubscription();
  const [dailyDebate, setDailyDebate] = useState<DailyDebateData>(initialDebate);
  const [userInput, setUserInput] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [shakeInput, setShakeInput] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Clear stale debate state on fresh page load (browser refresh)
  useEffect(() => {
    sessionStorage.removeItem('firstArgument');
    sessionStorage.removeItem('isInstantDebate');
  }, []);

  // Read query params to allow topic history links (/?topic=...&persona=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const topicParam = params.get('topic');
    const personaParam = params.get('persona');
    if (topicParam) {
      setDailyDebate({
        topic: topicParam,
        persona: personaParam || dailyDebate.persona,
      });
      // Clean URL without reload
      window.history.replaceState({}, '', '/');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          const debateId = uuidv4();

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

    // Guest Mode: server sets a signed guest_id cookie via /api/debate/create
    // No client-side cookie creation needed

    setIsStarting(true);
    const debateId = uuidv4();

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

      <main className="flex-1 flex flex-col items-center justify-center px-5 py-4 sm:py-6 relative z-10">
        <div className="w-full max-w-2xl">
          <StreakUrgencyBanner />
          {/* Hero — compact */}
          <div className="text-center mb-4 sm:mb-5">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mb-2">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-[var(--text)] leading-tight px-1">
                The AI that fights back.
              </h1>
            </div>
            <p className="text-sm sm:text-base text-[var(--text-secondary)] max-w-md mx-auto">
              Defend your position. Get challenged. Think harder.
            </p>
          </div>

          {/* Today's Debate Card — compact */}
          <div className="mb-4 animate-fade-up" style={{ animationDelay: '100ms' }} data-onboarding="topic">
            <div className="rounded-xl bg-[var(--bg-elevated)] p-4 sm:p-5 shadow-sm">
              {/* Topic label with shuffle button */}
              <div className="flex items-center justify-between mb-3">
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
                    const others = quickStarts.filter(q => q.topic !== dailyDebate.topic);
                    const random = others[Math.floor(Math.random() * others.length)];
                    setDailyDebate({
                      topic: random.topic,
                      persona: random.persona,
                    });
                    track('topic_shuffled', { newTopic: random.topic });
                  }}
                  className="ml-2 p-1.5 rounded-lg border border-[var(--border)] hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5 text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-all group"
                  title="Shuffle to a different topic"
                >
                  <svg className="w-4 h-4 group-active:rotate-180 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>

              {/* Topic — compact typography */}
              <h2 className="text-lg sm:text-xl font-serif font-semibold text-[var(--text)] mb-3 leading-snug">
                {dailyDebate.topic}
              </h2>

              {/* Opponent — compact */}
              <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[var(--bg-sunken)]/50 border border-[var(--border)]/50">
                <div className="w-8 h-8 rounded-full bg-[var(--accent)]/15 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

          {/* Argument Input — compact */}
          <form onSubmit={startDebate} className="animate-fade-up" style={{ animationDelay: '200ms' }}>
            <div
              data-onboarding="input"
              className={`
                rounded-xl bg-[var(--bg-elevated)] transition-all duration-200
                ${shakeInput ? 'animate-shake' : ''}
              `}
            >
              <div className="p-4">
                <label htmlFor="argument-input" className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)] mb-2">
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
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isStarting) {
                      startDebate();
                    }
                  }}
                  placeholder="Type your opening argument here to begin..."
                  className="w-full bg-transparent resize-none outline-none focus-visible:outline-none text-[var(--text)] placeholder-[var(--text-secondary)]/60 min-h-[80px] sm:min-h-[60px] text-base leading-relaxed"
                  disabled={isStarting}
                  autoFocus
                />

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-[var(--border)]/50">
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

            {/* CTA Row — compact */}
            <div className="flex flex-col sm:flex-row gap-2.5 mt-3">
              <button
                type="submit"
                disabled={isStarting}
                data-onboarding="cta"
                className={`
                  flex-1 h-11 px-5 rounded-lg font-medium text-sm transition-all duration-200
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
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isStarting}
                onClick={() => startDebate(undefined, "AI, you start the debate. Make your opening argument.")}
                className="h-11 px-4 rounded-lg font-medium text-sm border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text)] hover:bg-[var(--bg-sunken)] hover:border-[var(--border-strong)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
              >
                <svg className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>AI goes first</span>
              </button>
            </div>

            {/* Sign-in hint */}
            {!isSignedIn && (
              <p className="text-center text-xs text-[var(--text-secondary)] mt-2">
                Start immediately — no account needed
              </p>
            )}
          </form>

          {/* Quick Start Options — horizontal compact row */}
          <div className="mt-6 animate-fade-in" style={{ animationDelay: '300ms' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px flex-1 bg-[var(--border)]" />
              <p className="text-[10px] text-center text-[var(--text-secondary)] uppercase tracking-wider font-semibold">
                Or try
              </p>
              <div className="h-px flex-1 bg-[var(--border)]" />
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {quickStarts.map((option, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setDailyDebate({
                      topic: option.topic,
                      persona: option.persona,
                    });
                    if (inputRef.current) {
                      inputRef.current.focus();
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] bg-[var(--bg-elevated)] border border-[var(--border)] hover:border-[var(--accent)]/40 hover:text-[var(--accent)] hover:bg-[var(--accent)]/5 transition-all"
                >
                  {option.topic}
                </button>
              ))}
            </div>
          </div>

          {/* Upgrade Nudge */}
          {!isPremium && debatesUsed !== undefined && debatesUsed >= 2 && (
            <div className="mt-6 text-center animate-fade-in">
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium text-[var(--accent)] bg-[var(--accent)]/5 border border-[var(--accent)]/20 hover:bg-[var(--accent)]/10 hover:scale-105 transition-all cursor-pointer"
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
