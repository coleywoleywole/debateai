'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSafeUser, useSafeClerk } from '@/lib/useSafeClerk';
import { getRelatedTopics } from '@/lib/topics';
import { PERSONAS } from '@/lib/personas';
import { track } from '@/lib/analytics';
import { useToast } from './Toast';

interface PostDebateEngagementProps {
  debateId: string;
  topic: string;
  opponentName?: string;
  opponentId?: string;
}

/**
 * Post-debate engagement flow shown after the score card.
 * Drives repeat debates via rematch, related topics, and social sharing.
 */
export default function PostDebateEngagement({
  debateId,
  topic,
  opponentName = 'AI',
  opponentId,
}: PostDebateEngagementProps) {
  const router = useRouter();
  const { isSignedIn } = useSafeUser();
  const { openSignIn } = useSafeClerk();
  const { showToast } = useToast();
  const [isStarting, setIsStarting] = useState<string | null>(null); // tracks which button is loading

  // Generate related topics once (stable across re-renders)
  const relatedTopics = useMemo(() => getRelatedTopics(topic, 3), [topic]);

  // Pick a random opponent for suggested topics (different from current)
  const getRandomOpponent = () => {
    const others = PERSONAS.filter(p => p.id !== opponentId);
    return others[Math.floor(Math.random() * others.length)];
  };

  const startDebate = async (newTopic: string, persona: string, source: string) => {
    if (isStarting) return;

    if (!isSignedIn) {
      sessionStorage.setItem(
        'pendingDebate',
        JSON.stringify({
          userInput: '',
          topic: newTopic,
          persona,
          fromLandingPage: true,
        }),
      );
      openSignIn({ afterSignInUrl: '/' });
      return;
    }

    setIsStarting(source);
    const newDebateId = crypto.randomUUID();

    try {
      const response = await fetch('/api/debate/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character: 'custom',
          opponentStyle: persona,
          topic: newTopic,
          debateId: newDebateId,
        }),
      });

      if (response.ok) {
        track('debate_rematch', {
          debateId: newDebateId,
          originalDebateId: debateId,
          topic: newTopic,
          opponent: persona,
          source,
        });
        sessionStorage.setItem('isInstantDebate', 'true');
        router.push(`/debate/${newDebateId}`);
      } else {
        const data = await response.json();
        if (response.status === 429 && data.error === 'debate_limit_exceeded') {
          showToast('Debate limit reached. Upgrade for unlimited debates!', 'error');
        } else {
          showToast('Failed to start debate. Please try again.', 'error');
        }
        setIsStarting(null);
      }
    } catch {
      showToast('Network error. Please try again.', 'error');
      setIsStarting(null);
    }
  };

  const handleShare = async () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://debateai.org';
    const shareUrl = `${baseUrl}/debate/${debateId}`;
    const shareText = `I just debated "${topic}" on DebateAI — think you can do better?`;

    // Try native share first (mobile)
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'DebateAI Challenge', text: shareText, url: shareUrl });
        track('debate_shared', { debateId, method: 'native_share', source: 'post_debate' });
        return;
      } catch {
        // User cancelled or not supported — fall through to clipboard
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      track('debate_shared', { debateId, method: 'copy_link', source: 'post_debate' });
      showToast('Challenge link copied!', 'success');
    } catch {
      showToast('Could not copy link', 'error');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-8">
      {/* Rematch + Share row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Debate Again — same topic, same opponent */}
        <button
          onClick={() => startDebate(topic, opponentName, 'rematch')}
          disabled={isStarting !== null}
          className={`
            flex-1 flex items-center justify-center gap-2 h-12 px-5 rounded-xl font-medium text-sm transition-all
            ${isStarting === 'rematch'
              ? 'bg-[var(--accent)]/80 text-white cursor-wait'
              : 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/25 hover:shadow-xl hover:shadow-[var(--accent)]/35 hover:-translate-y-0.5 active:translate-y-0'
            }
            ${isStarting && isStarting !== 'rematch' ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {isStarting === 'rematch' ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Starting…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Debate Again
            </>
          )}
        </button>

        {/* Share & Challenge */}
        <button
          onClick={handleShare}
          className="flex-1 flex items-center justify-center gap-2 h-12 px-5 rounded-xl font-medium text-sm border border-[var(--accent)]/30 text-[var(--accent)] bg-[var(--accent)]/5 hover:bg-[var(--accent)]/10 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          Share & Challenge
        </button>
      </div>

      {/* Related Topics */}
      {relatedTopics.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-secondary)]">
              Try Next
            </span>
            <span className="h-px flex-1 bg-[var(--border)]" />
          </div>

          <div className="space-y-2">
            {relatedTopics.map((rt) => {
              const randomOpp = getRandomOpponent();
              const key = `topic-${rt.id}`;

              return (
                <button
                  key={rt.id}
                  onClick={() => startDebate(rt.question, randomOpp.name, key)}
                  disabled={isStarting !== null}
                  className={`
                    w-full group flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left
                    ${isStarting === key
                      ? 'border-[var(--accent)]/30 bg-[var(--accent)]/5'
                      : 'border-[var(--border)]/30 bg-[var(--bg-elevated)]/50 hover:border-[var(--accent)]/30 hover:bg-[var(--bg-elevated)]'
                    }
                    ${isStarting && isStarting !== key ? 'opacity-50' : ''}
                  `}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text)] group-hover:text-[var(--accent)] transition-colors leading-snug">
                      {rt.question}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      vs. {randomOpp.name}
                    </p>
                  </div>

                  <div className="shrink-0">
                    {isStarting === key ? (
                      <svg className="w-4 h-4 text-[var(--accent)] animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-[var(--accent)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Explore link */}
      <div className="mt-4 text-center">
        <Link
          href="/explore"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          Browse more debates →
        </Link>
      </div>
    </div>
  );
}
