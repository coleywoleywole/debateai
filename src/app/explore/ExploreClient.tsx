'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { track } from '@/lib/analytics';

// ── Types ────────────────────────────────────────────────────────

type Tab = 'rankings' | 'debates';

// Rankings Types
type Period = 'alltime' | 'weekly';
type RankingSort = 'points' | 'streak' | 'debates' | 'avg_score';

interface RankingEntry {
  rank: number;
  userId: string;
  displayName: string | null;
  username: string | null;
  totalDebates: number;
  totalWins: number;
  currentStreak: number;
  longestStreak: number;
  avgScore: number;
  totalPoints: number;
}

// Debates Types
type DebateSort = 'recent' | 'top_scored' | 'most_messages';

interface DebateCard {
  id: string;
  topic: string;
  opponent: string | null;
  messageCount: number;
  previewMessage: string;
  userScore: number | null;
  aiScore: number | null;
  winner: 'user' | 'ai' | 'draw' | null;
  summary: string | null;
  createdAt: string;
}

interface Pagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// ── Constants ────────────────────────────────────────────────────

const RANKING_SORT_OPTIONS: { value: RankingSort; label: string; icon: string }[] = [
  { value: 'points', label: 'Points', icon: '⭐' },
  { value: 'streak', label: 'Streak', icon: '🔥' },
  { value: 'debates', label: 'Debates', icon: '💬' },
  { value: 'avg_score', label: 'Avg Score', icon: '📊' },
];

const DEBATE_SORT_OPTIONS: { value: DebateSort; label: string; icon: string }[] = [
  { value: 'recent', label: 'Recent', icon: '🕐' },
  { value: 'top_scored', label: 'Top Scored', icon: '⭐' },
  { value: 'most_messages', label: 'Most Messages', icon: '💬' },
];

// ── Helpers ──────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-lg">🥇</span>;
  if (rank === 2) return <span className="text-lg">🥈</span>;
  if (rank === 3) return <span className="text-lg">🥉</span>;
  return (
    <span className="w-7 h-7 rounded-full bg-[var(--bg-sunken)] flex items-center justify-center text-xs font-semibold text-[var(--text-secondary)] tabular-nums">
      {rank}
    </span>
  );
}

function WinnerBadge({ winner }: { winner: 'user' | 'ai' | 'draw' | null }) {
  if (!winner) return null;
  const config = {
    user: { emoji: '🏆', label: 'User won', cls: 'text-green-600 dark:text-green-400 bg-green-500/10' },
    ai: { emoji: '🤖', label: 'AI won', cls: 'text-orange-600 dark:text-orange-400 bg-orange-500/10' },
    draw: { emoji: '🤝', label: 'Draw', cls: 'text-blue-600 dark:text-blue-400 bg-blue-500/10' },
  };
  const c = config[winner];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${c.cls}`}>
      {c.emoji} {c.label}
    </span>
  );
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Main Component ───────────────────────────────────────────────

export default function ExploreClient() {
  const [activeTab, setActiveTab] = useState<Tab>('rankings');

  // Rankings State
  const [rankingPeriod, setRankingPeriod] = useState<Period>('alltime');
  const [rankingSort, setRankingSort] = useState<RankingSort>('points');
  const [rankings, setRankings] = useState<RankingEntry[]>([]);

  // Debates State
  const [debateSort, setDebateSort] = useState<DebateSort>('recent');
  const [debates, setDebates] = useState<DebateCard[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Common State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Data Fetching ──────────────────────────────────────────────

  const fetchRankings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/explore/rankings?period=${rankingPeriod}&sort=${rankingSort}&limit=50`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setRankings(data.entries);
    } catch {
      setError('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, [rankingPeriod, rankingSort]);

  const fetchDebates = useCallback(
    async (offset = 0, append = false) => {
      if (!append) setLoading(true);
      else setLoadingMore(true);
      setError(null);

      try {
        const res = await fetch(`/api/explore/debates?sort=${debateSort}&limit=20&offset=${offset}`);
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();

        if (append) {
          setDebates((prev) => [...prev, ...data.debates]);
        } else {
          setDebates(data.debates);
        }
        setPagination(data.pagination);
      } catch {
        setError('Failed to load debates');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [debateSort],
  );

  useEffect(() => {
    if (activeTab === 'rankings') {
      fetchRankings();
    } else {
      fetchDebates(0, false);
    }
  }, [activeTab, fetchRankings, fetchDebates]);

  const handleDebateClick = (debate: DebateCard) => {
    track('explore_debate_viewed', {
      debateId: debate.id,
      topic: debate.topic,
      source: 'explore',
    });
  };

  return (
    <div>
      {/* Tab Switcher */}
      <div className="flex p-1 bg-[var(--bg-sunken)] rounded-xl mb-6 max-w-sm mx-auto">
        <button
          onClick={() => setActiveTab('rankings')}
          className={`flex-1 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'rankings'
              ? 'bg-[var(--bg)] text-[var(--text)] shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
          }`}
        >
          🏆 Rankings
        </button>
        <button
          onClick={() => setActiveTab('debates')}
          className={`flex-1 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'debates'
              ? 'bg-[var(--bg)] text-[var(--text)] shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
          }`}
        >
          🏟️ Debates
        </button>
      </div>

      {/* Rankings Controls */}
      {activeTab === 'rankings' && (
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
            {(['alltime', 'weekly'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setRankingPeriod(p)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  rankingPeriod === p
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text)]'
                }`}
              >
                {p === 'alltime' ? 'All Time' : 'This Week'}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {RANKING_SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRankingSort(opt.value)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  rankingSort === opt.value
                    ? 'bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--accent)]/30'
                }`}
              >
                <span>{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Debates Controls */}
      {activeTab === 'debates' && (
        <div className="flex gap-1.5 mb-6 flex-wrap">
          {DEBATE_SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDebateSort(opt.value)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                debateSort === opt.value
                  ? 'bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--accent)]/30'
              }`}
            >
              <span>{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-center py-12">
          <p className="text-sm text-[var(--error)]">{error}</p>
          <button 
            onClick={() => activeTab === 'rankings' ? fetchRankings() : fetchDebates(0, false)} 
            className="mt-2 text-xs text-[var(--accent)] hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !error && (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div 
              key={i} 
              className="flex items-center gap-3 p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)]/50 animate-pulse"
            >
              <div className="w-8 h-8 rounded-full bg-[var(--bg-sunken)]" />
              <div className="flex-1">
                <div className="h-4 bg-[var(--bg-sunken)] rounded w-32 mb-2" />
                <div className="h-3 bg-[var(--bg-sunken)] rounded w-48" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rankings Content */}
      {!loading && !error && activeTab === 'rankings' && (
        <>
          {rankings.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--bg-sunken)] border border-[var(--border)] flex items-center justify-center text-3xl">🏆</div>
              <h3 className="text-lg font-semibold text-[var(--text)] mb-2">No debaters yet</h3>
              <p className="text-sm text-[var(--text-secondary)] mb-6">Complete a debate to appear on the leaderboard.</p>
              <Link href="/debate" className="btn btn-primary">Start Debating</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {rankings.map((entry) => (
                <div key={entry.userId} className={`flex items-center gap-3 p-3.5 sm:p-4 rounded-xl border transition-colors ${entry.rank <= 3 ? 'bg-[var(--accent)]/3 border-[var(--accent)]/15' : 'bg-[var(--bg-elevated)] border-[var(--border)]/50'}`}>
                  <div className="flex-shrink-0 w-8 flex justify-center">
                    <RankBadge rank={entry.rank} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {entry.username ? (
                        <Link href={`/profile/${entry.username}`} className="text-sm font-semibold text-[var(--text)] hover:text-[var(--accent)] truncate">
                          {entry.displayName || `Debater ${entry.userId.slice(-4)}`}
                        </Link>
                      ) : (
                        <span className="text-sm font-semibold text-[var(--text)] truncate">
                          {entry.displayName || `Debater ${entry.userId.slice(-4)}`}
                        </span>
                      )}
                      {entry.currentStreak > 0 && <span className="text-xs text-orange-500 font-medium">🔥 {entry.currentStreak}</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)] mt-0.5">
                      <span>{entry.totalDebates} {entry.totalDebates === 1 ? 'debate' : 'debates'}</span>
                      <span>·</span>
                      <span>Avg {entry.avgScore}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className="text-sm font-bold text-[var(--accent)] tabular-nums">{entry.totalPoints}</span>
                    <span className="text-[10px] text-[var(--text-tertiary)] ml-1">pts</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="mt-8 p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
            <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">How Points Work</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: '✅', label: 'Complete', value: '+10' },
                { icon: '🏆', label: 'Win', value: '+5' },
                { icon: '🔥', label: 'Streak/day', value: '+2' },
                { icon: '📤', label: 'Share', value: '+3' },
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <div className="text-lg mb-0.5">{item.icon}</div>
                  <div className="text-xs font-semibold text-[var(--accent)]">{item.value}</div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Debates Content */}
      {!loading && !error && activeTab === 'debates' && (
        <>
          {debates.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="text-4xl mb-3">🏟️</div>
              <h3 className="text-lg font-semibold text-[var(--text)] mb-2">No debates yet</h3>
              <p className="text-sm text-[var(--text-secondary)] mb-6">Be the first to complete a debate and appear here!</p>
              <Link href="/" className="btn btn-primary">Start a Debate →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {debates.map((debate) => (
                <Link key={debate.id} href={`/debate/${debate.id}`} onClick={() => handleDebateClick(debate)} className="block group">
                  <div className="rounded-xl border border-[var(--border)]/50 bg-[var(--bg-elevated)] p-4 sm:p-5 transition-all hover:border-[var(--accent)]/30 hover:shadow-md">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="text-sm sm:text-base font-semibold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors leading-snug flex-1">
                        {debate.topic}
                      </h3>
                      <WinnerBadge winner={debate.winner} />
                    </div>
                    {debate.previewMessage && (
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3 line-clamp-2 italic">
                        &ldquo;{debate.previewMessage}&rdquo;
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-[11px] text-[var(--text-tertiary)]">
                        {debate.opponent && <span>vs {debate.opponent}</span>}
                        <span>{debate.messageCount} messages</span>
                        {debate.userScore != null && <span>{debate.userScore}–{debate.aiScore}</span>}
                      </div>
                      <span className="text-[11px] text-[var(--text-tertiary)]">{timeAgo(debate.createdAt)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {pagination?.hasMore && (
            <div className="mt-6 text-center">
              <button
                onClick={() => fetchDebates(pagination.offset + pagination.limit, true)}
                disabled={loadingMore}
                className="px-5 py-2.5 rounded-xl text-sm font-medium border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text)] disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Show more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
