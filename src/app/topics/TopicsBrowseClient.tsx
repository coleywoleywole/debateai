'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Spinner from '@/components/Spinner';
import UpgradeModal from '@/components/UpgradeModal';
import { useTrending, type TrendingTopic } from '@/lib/useTrending';
import { v4 as uuidv4 } from 'uuid';

interface BrowseTopic {
  id: string;
  question: string;
  category: string;
  categoryEmoji: string;
  spicyLevel?: number;
  persona?: string;
  source: 'curated' | 'daily';
}

interface BrowseCategory {
  id: string;
  name: string;
  emoji: string;
  description: string;
  topics: BrowseTopic[];
}

interface StatsTopTopic {
  topic: string;
  count: number;
}

export default function TopicsBrowseClient() {
  const router = useRouter();
  const [categories, setCategories] = useState<BrowseCategory[]>([]);
  const [totalTopics, setTotalTopics] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [startingId, setStartingId] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [mostDebated, setMostDebated] = useState<StatsTopTopic[]>([]);

  // Trending topics from existing hook
  const { topics: trendingTopics, loading: trendingLoading } = useTrending();

  // Fetch browse data
  useEffect(() => {
    async function fetchBrowse() {
      try {
        const res = await fetch('/api/topics/browse');
        if (res.ok) {
          const data = await res.json();
          setCategories(data.categories || []);
          setTotalTopics(data.totalTopics || 0);
        }
      } catch {
        // Fail silently — page still works with trending/most debated
      } finally {
        setLoading(false);
      }
    }
    fetchBrowse();
  }, []);

  // Fetch most debated from stats
  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/stats');
        if (res.ok) {
          const data = await res.json();
          setMostDebated(data.topTopics || []);
        }
      } catch {
        // non-critical
      }
    }
    fetchStats();
  }, []);

  const startDebate = async (topic: string, persona?: string) => {
    setStartingId(topic);
    const debateId = uuidv4();
    try {
      const response = await fetch('/api/debate/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character: 'custom',
          opponentStyle: persona || "Devil's advocate",
          topic,
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
        setStartingId(null);
      }
    } catch {
      setStartingId(null);
    }
  };

  const filteredCategories =
    activeCategory === 'all'
      ? categories
      : categories.filter((c) => c.id === activeCategory);

  return (
    <div className="min-h-dvh flex flex-col">
      <Header />

      <main className="flex-1 px-5 py-8 sm:py-12">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="h-px w-8 bg-gradient-to-r from-transparent to-[var(--accent)] opacity-50" />
              <span className="text-[11px] font-semibold text-[var(--accent)] uppercase tracking-[0.2em]">
                Browse Topics
              </span>
              <span className="h-px w-8 bg-gradient-to-l from-transparent to-[var(--accent)] opacity-50" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-serif font-semibold text-[var(--text)] mb-3 leading-tight">
              What do you want to debate?
            </h1>
            <p className="text-base text-[var(--text-secondary)] max-w-lg mx-auto">
              {totalTopics > 0
                ? `${totalTopics}+ topics across ${categories.length} categories. Pick one and challenge AI.`
                : 'Explore topics across categories. Pick one and challenge AI.'}
            </p>
          </div>

          {/* Trending Now */}
          {!trendingLoading && trendingTopics.length > 0 && (
            <section className="mb-10 animate-fade-up">
              <h2 className="text-sm font-semibold text-[var(--text)] uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="text-base">📈</span> Trending Now
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {trendingTopics.slice(0, 6).map((t) => (
                  <TrendingCard
                    key={t.id}
                    topic={t}
                    onDebate={() => startDebate(t.question)}
                    isStarting={startingId === t.question}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Most Debated */}
          {mostDebated.length > 0 && (
            <section className="mb-10 animate-fade-up" style={{ animationDelay: '100ms' }}>
              <h2 className="text-sm font-semibold text-[var(--text)] uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="text-base">🏆</span> Most Debated
              </h2>
              <div className="flex flex-wrap gap-2">
                {mostDebated.slice(0, 10).map((t, i) => (
                  <button
                    key={i}
                    onClick={() => startDebate(t.topic)}
                    disabled={startingId === t.topic}
                    className="group flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)]/30 hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5 transition-all text-left"
                  >
                    <span className="text-sm text-[var(--text)] group-hover:text-[var(--accent)] transition-colors line-clamp-1">
                      {t.topic}
                    </span>
                    <span className="text-[10px] font-mono text-[var(--text-tertiary)] shrink-0">
                      {t.count}x
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeCategory === 'all'
                  ? 'bg-[var(--accent)] text-white shadow-sm'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--accent)]/40 hover:text-[var(--accent)]'
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeCategory === cat.id
                    ? 'bg-[var(--accent)] text-white shadow-sm'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--accent)]/40 hover:text-[var(--accent)]'
                }`}
              >
                {cat.emoji} {cat.name}
              </button>
            ))}
          </div>

          {/* Topics Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner className="w-6 h-6" />
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="text-center py-16 text-[var(--text-secondary)]">
              No topics found.
            </div>
          ) : (
            <div className="space-y-10">
              {filteredCategories.map((cat) => (
                <section key={cat.id} className="animate-fade-up">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xl">{cat.emoji}</span>
                    <h2 className="text-lg font-serif font-semibold text-[var(--text)]">
                      {cat.name}
                    </h2>
                    <span className="text-xs text-[var(--text-tertiary)] font-mono">
                      {cat.topics.length}
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {cat.topics.map((topic) => (
                      <TopicCard
                        key={topic.id}
                        topic={topic}
                        onDebate={() => startDebate(topic.question, topic.persona)}
                        isStarting={startingId === topic.question}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="mt-12 flex items-center justify-center gap-6 text-xs text-[var(--text-secondary)]">
            <Link href="/" className="hover:text-[var(--text)] transition-colors flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
              </svg>
              Today&apos;s Debate
            </Link>
            <span className="w-1 h-1 rounded-full bg-[var(--border-strong)]" />
            <Link href="/debate" className="hover:text-[var(--text)] transition-colors">
              Custom Debate
            </Link>
            <span className="w-1 h-1 rounded-full bg-[var(--border-strong)]" />
            <Link href="/topics/history" className="hover:text-[var(--text)] transition-colors">
              Past Daily Topics
            </Link>
          </div>
        </div>
      </main>

      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} trigger="button" />
    </div>
  );
}

function TopicCard({
  topic,
  onDebate,
  isStarting,
}: {
  topic: BrowseTopic;
  onDebate: () => void;
  isStarting: boolean;
}) {
  return (
    <div className="group rounded-xl border border-[var(--border)]/30 bg-[var(--bg-elevated)]/50 p-4 hover:border-[var(--accent)]/30 transition-all flex flex-col">
      <div className="flex-1">
        <p className="text-sm font-semibold text-[var(--text)] leading-snug mb-2">
          {topic.question}
        </p>
        {topic.persona && (
          <p className="text-xs text-[var(--text-secondary)]">
            vs. <span className="font-medium text-[var(--accent)]">{topic.persona}</span>
          </p>
        )}
        {topic.spicyLevel && topic.spicyLevel >= 3 && (
          <span className="inline-block mt-1.5 text-[10px] font-semibold text-orange-500">
            🌶️ Spicy
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Link
          href={`/topics/${topic.id}`}
          className="text-[10px] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
        >
          Details
        </Link>
        <button
          onClick={onDebate}
          disabled={isStarting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--accent)] bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 transition-colors disabled:opacity-50"
        >
          {isStarting ? (
            <Spinner className="w-3 h-3" />
          ) : (
            <>
              Debate This
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function TrendingCard({
  topic,
  onDebate,
  isStarting,
}: {
  topic: TrendingTopic;
  onDebate: () => void;
  isStarting: boolean;
}) {
  const heatLabel = topic.heat === 3 ? '🔥🔥🔥' : topic.heat === 2 ? '🔥🔥' : '🔥';

  return (
    <div className="group rounded-xl border border-[var(--border)]/30 bg-[var(--bg-elevated)]/50 p-4 hover:border-[var(--accent)]/30 transition-all flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs">{heatLabel}</span>
        <span className="text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">
          {topic.category}
        </span>
      </div>
      <p className="text-sm font-semibold text-[var(--text)] leading-snug mb-1.5 flex-1">
        {topic.question}
      </p>
      <p className="text-xs text-[var(--text-tertiary)] mb-3 line-clamp-2">{topic.context}</p>
      <button
        onClick={onDebate}
        disabled={isStarting}
        className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--accent)] bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 transition-colors disabled:opacity-50"
      >
        {isStarting ? (
          <Spinner className="w-3 h-3" />
        ) : (
          <>
            Debate This
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </>
        )}
      </button>
    </div>
  );
}
