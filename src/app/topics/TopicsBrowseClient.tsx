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
            <section className="mb-12 animate-fade-up">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[var(--text)]">Trending Now</h2>
                  <p className="text-xs text-[var(--text-tertiary)]">Most popular topics this week</p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            <section className="mb-12 animate-fade-up" style={{ animationDelay: '100ms' }}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-yellow-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[var(--text)]">Most Debated</h2>
                  <p className="text-xs text-[var(--text-tertiary)]">Topics with the most activity</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {mostDebated.slice(0, 10).map((t, i) => (
                  <button
                    key={i}
                    onClick={() => startDebate(t.topic)}
                    disabled={startingId === t.topic}
                    className="group inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] hover:border-[var(--accent)]/50 hover:bg-[var(--accent)]/5 transition-all text-left"
                  >
                    <span className="text-sm text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
                      {t.topic}
                    </span>
                    <span className="text-xs font-medium text-[var(--text-tertiary)] bg-[var(--border)]/50 px-2 py-0.5 rounded-full">
                      {t.count}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2 mb-8 pb-6 border-b border-[var(--border)]">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeCategory === 'all'
                  ? 'bg-[var(--accent)] text-white shadow-sm'
                  : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              All Topics
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  activeCategory === cat.id
                    ? 'bg-[var(--accent)] text-white shadow-sm'
                    : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--bg-elevated)]'
                }`}
              >
                {cat.name}
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
            <div className="space-y-12">
              {filteredCategories.map((cat) => (
                <section key={cat.id} className="animate-fade-up">
                  <div className="flex items-center gap-3 mb-5">
                    <h2 className="text-lg font-semibold text-[var(--text)]">
                      {cat.name}
                    </h2>
                    <span className="text-xs font-medium text-[var(--text-tertiary)] bg-[var(--bg-elevated)] px-2 py-0.5 rounded-full">
                      {cat.topics.length}
                    </span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          <div className="mt-16 pt-8 border-t border-[var(--border)] flex items-center justify-center gap-6 text-sm text-[var(--text-secondary)]">
            <Link href="/" className="hover:text-[var(--text)] transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
              </svg>
              Today's Debate
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
    <div className="group rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/30 p-5 hover:border-[var(--accent)]/30 hover:bg-[var(--bg-elevated)] transition-all flex flex-col h-full">
      <div className="flex-1">
        <p className="text-sm font-medium text-[var(--text)] leading-relaxed mb-3">
          {topic.question}
        </p>
        {topic.persona && (
          <p className="text-xs text-[var(--text-secondary)] mb-2">
            vs. <span className="font-medium text-[var(--accent)]">{topic.persona}</span>
          </p>
        )}
        {topic.spicyLevel && topic.spicyLevel >= 3 && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-orange-500 bg-orange-500/10 px-2 py-1 rounded-full">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
            </svg>
            Spicy
          </span>
        )}
      </div>
      <div className="mt-4 pt-4 border-t border-[var(--border)]/50 flex items-center justify-between">
        <Link
          href={`/topics/${topic.id}`}
          className="text-xs text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
        >
          Details
        </Link>
        <button
          onClick={onDebate}
          disabled={isStarting}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 transition-colors disabled:opacity-50"
        >
          {isStarting ? (
            <Spinner className="w-3 h-3" />
          ) : (
            <>
              Debate
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
  const heatColor = topic.heat === 3 ? 'text-red-500' : topic.heat === 2 ? 'text-orange-500' : 'text-amber-500';

  return (
    <div className="group rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/30 p-5 hover:border-[var(--accent)]/30 hover:bg-[var(--bg-elevated)] transition-all flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs font-medium ${heatColor} flex items-center gap-1`}>
          {topic.heat === 3 && 'Hot'}
          {topic.heat === 2 && 'Warm'}
          {topic.heat === 1 && 'New'}
        </span>
        <span className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
          {topic.category}
        </span>
      </div>
      <p className="text-sm font-medium text-[var(--text)] leading-relaxed mb-2 flex-1">
        {topic.question}
      </p>
      <p className="text-xs text-[var(--text-secondary)] mb-4 line-clamp-2">{topic.context}</p>
      <button
        onClick={onDebate}
        disabled={isStarting}
        className="self-start flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 transition-colors disabled:opacity-50"
      >
        {isStarting ? (
          <Spinner className="w-3 h-3" />
        ) : (
          <>
            Debate
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </>
        )}
      </button>
    </div>
  );
}
