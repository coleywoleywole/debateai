'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Spinner from '@/components/Spinner';
import UpgradeModal from '@/components/UpgradeModal';
import { v4 as uuidv4 } from 'uuid';
import type { Category } from '@/lib/categories';

interface TopicData {
  id: string;
  question: string;
  description?: string;
  spicyLevel: number;
  categoryId: string;
}

interface CommunityDebate {
  id: string;
  topic: string;
  opponent: string;
  created_at: string;
}

interface RelatedTopic {
  id: string;
  question: string;
  spicyLevel: number;
}

interface Persona {
  name: string;
  style: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export default function TopicPageClient({
  topic,
  category,
  communityDebates,
  relatedTopics,
  personas,
}: {
  topic: TopicData;
  category: Category;
  communityDebates: CommunityDebate[];
  relatedTopics: RelatedTopic[];
  personas: Persona[];
}) {
  const router = useRouter();
  const [startingPersona, setStartingPersona] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const startDebate = async (personaName: string) => {
    setStartingPersona(personaName);
    const debateId = uuidv4();

    try {
      const response = await fetch('/api/debate/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character: 'custom',
          opponentStyle: personaName,
          topic: topic.question,
          debateId,
        }),
      });

      if (response.ok) {
        router.push(`/debate/${debateId}`);
      } else {
        const error = await response.json();
        if (response.status === 429 && error.error === 'debate_limit_exceeded') {
          setShowUpgradeModal(true);
        }
        setStartingPersona(null);
      }
    } catch {
      setStartingPersona(null);
    }
  };

  return (
    <main className="flex-1 px-5 py-8 sm:py-12">
      <div className="max-w-3xl mx-auto">
        {/* Back link */}
        <Link
          href="/topics"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors mb-6"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All Topics
        </Link>

        {/* Hero */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">{category.emoji}</span>
            <span className="text-[10px] font-semibold text-[var(--accent)] uppercase tracking-[0.15em]">
              {category.name}
            </span>
            {topic.spicyLevel >= 3 && (
              <span className="text-[10px] font-semibold text-orange-500 ml-1">
                🌶️ Spicy
              </span>
            )}
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif font-semibold text-[var(--text)] mb-4 leading-tight">
            {topic.question}
          </h1>
          {topic.description && (
            <p className="text-base text-[var(--text-secondary)] leading-relaxed">
              {topic.description}
            </p>
          )}
        </div>

        {/* Quick CTA */}
        <div className="mb-10">
          <button
            onClick={() => startDebate("Devil's Advocate")}
            disabled={startingPersona !== null}
            className={`
              h-12 px-6 rounded-xl font-medium text-sm transition-all duration-200
              flex items-center justify-center gap-2
              ${startingPersona === null
                ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/30 hover:shadow-xl hover:shadow-[var(--accent)]/40 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer'
                : 'bg-[var(--bg-sunken)] text-[var(--text-secondary)] cursor-not-allowed'
              }
            `}
          >
            {startingPersona ? (
              <>
                <Spinner className="h-4 w-4" />
                <span>Starting...</span>
              </>
            ) : (
              <>
                <span>Debate This Topic</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </>
            )}
          </button>
        </div>

        {/* Choose Opponent */}
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-[var(--text)] uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="text-base">🎭</span> Choose Your Opponent
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {personas.map((p) => (
              <button
                key={p.name}
                onClick={() => startDebate(p.name)}
                disabled={startingPersona !== null}
                className="group rounded-xl border border-[var(--border)]/30 bg-[var(--bg-elevated)]/50 p-4 hover:border-[var(--accent)]/30 transition-all text-left disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="text-sm font-semibold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
                    {p.name}
                  </h3>
                  {startingPersona === p.name ? (
                    <Spinner className="w-3.5 h-3.5" />
                  ) : (
                    <svg className="w-3.5 h-3.5 text-[var(--text-tertiary)] group-hover:text-[var(--accent)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  )}
                </div>
                <p className="text-xs text-[var(--text-secondary)]">{p.style}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Community Debates */}
        {communityDebates.length > 0 && (
          <section className="mb-10">
            <h2 className="text-sm font-semibold text-[var(--text)] uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="text-base">👥</span> Community Debates
            </h2>
            <div className="space-y-2">
              {communityDebates.map((d) => (
                <Link
                  key={d.id}
                  href={`/debate/${d.id}`}
                  className="group flex items-center justify-between p-3 rounded-xl border border-[var(--border)]/30 bg-[var(--bg-elevated)]/50 hover:border-[var(--accent)]/30 transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text)] truncate">{d.topic}</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      vs. <span className="font-medium">{d.opponent}</span>
                      <span className="mx-1.5">·</span>
                      {timeAgo(d.created_at)}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-[var(--accent)] transition-colors shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Related Topics */}
        {relatedTopics.length > 0 && (
          <section className="mb-10">
            <h2 className="text-sm font-semibold text-[var(--text)] uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="text-base">🔗</span> Related Topics
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {relatedTopics.map((t) => (
                <Link
                  key={t.id}
                  href={`/topics/${t.id}`}
                  className="group flex items-center justify-between p-3 rounded-xl border border-[var(--border)]/30 bg-[var(--bg-elevated)]/50 hover:border-[var(--accent)]/30 transition-all"
                >
                  <span className="text-sm text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
                    {t.question}
                  </span>
                  <svg className="w-3.5 h-3.5 text-[var(--text-tertiary)] group-hover:text-[var(--accent)] transition-colors shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <div className="mt-12 flex items-center justify-center gap-6 text-xs text-[var(--text-secondary)]">
          <Link href="/topics" className="hover:text-[var(--text)] transition-colors flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
            </svg>
            All Topics
          </Link>
          <span className="w-1 h-1 rounded-full bg-[var(--border-strong)]" />
          <Link href="/" className="hover:text-[var(--text)] transition-colors">
            Today&apos;s Debate
          </Link>
        </div>
      </div>

      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} trigger="button" />
    </main>
  );
}
