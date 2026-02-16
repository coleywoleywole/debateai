'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

type Tab = 'rankings' | 'recent';
type Period = 'alltime' | 'weekly';
type Sort = 'points' | 'streak' | 'debates' | 'avg_score';

interface Entry {
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

interface PublicDebate {
  id: string;
  opponent: string;
  topic: string;
  createdAt: string;
  author: {
    username: string | null;
    displayName: string;
  };
}

const SORT_OPTIONS: { value: Sort; label: string; icon: string }[] = [
  { value: 'points', label: 'Points', icon: '⭐' },
  { value: 'streak', label: 'Streak', icon: '🔥' },
  { value: 'debates', label: 'Debates', icon: '💬' },
  { value: 'avg_score', label: 'Avg Score', icon: '📊' },
];

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

export default function ExploreClient() {
  const [activeTab, setActiveTab] = useState<Tab>('rankings');
  const [period, setPeriod] = useState<Period>('alltime');
  const [sort, setSort] = useState<Sort>('points');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [publicDebates, setPublicDebates] = useState<PublicDebate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'rankings') {
        const res = await fetch(`/api/explore?period=${period}&sort=${sort}&limit=50`);
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        setEntries(data.entries);
      } else {
        const res = await fetch(`/api/debates/public?limit=30`);
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        setPublicDebates(data.debates);
      }
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [activeTab, period, sort]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div>
      {/* Top Tabs */}
      <div className="flex p-1 bg-[var(--bg-sunken)] rounded-xl mb-6 max-w-sm mx-auto">
        <button
          onClick={() => setActiveTab('rankings')}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'rankings'
              ? 'bg-[var(--bg)] text-[var(--accent)] shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
          }`}
        >
          Rankings
        </button>
        <button
          onClick={() => setActiveTab('recent')}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'recent'
              ? 'bg-[var(--bg)] text-[var(--accent)] shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
          }`}
        >
          Recent
        </button>
      </div>

      {activeTab === 'rankings' && (
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Period toggle */}
          <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
            {(['alltime', 'weekly'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  period === p
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text)]'
                }`}
              >
                {p === 'alltime' ? 'All Time' : 'This Week'}
              </button>
            ))}
          </div>

          {/* Sort options */}
          <div className="flex gap-1.5 flex-wrap">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSort(opt.value)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  sort === opt.value
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

      {/* Content Area with min-height to prevent layout shift */}
      <div className="min-h-[400px]">
        {/* Error */}
        {error && (
          <div className="text-center py-12">
            <p className="text-sm text-[var(--error)]">{error}</p>
            <button onClick={fetchData} className="mt-2 text-xs text-[var(--accent)] hover:underline">
              Try again
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && !error && (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div 
                key={i} 
                className="flex items-center gap-3 p-3.5 sm:p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)]/50"
              >
                <div className="flex-shrink-0 w-8 flex justify-center">
                  <div className="w-7 h-7 rounded-full bg-[var(--bg-sunken)] animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="h-4 bg-[var(--bg-sunken)] rounded animate-pulse w-32 mb-1.5" />
                  <div className="flex items-center gap-1.5">
                    <div className="h-3 bg-[var(--bg-sunken)] rounded animate-pulse w-16" />
                    <span className="text-[var(--text-tertiary)]">·</span>
                    <div className="h-3 bg-[var(--bg-sunken)] rounded animate-pulse w-8" />
                    <span className="text-[var(--text-tertiary)]">·</span>
                    <div className="h-3 bg-[var(--bg-sunken)] rounded animate-pulse w-12" />
                  </div>
                </div>
                <div className="flex-shrink-0 text-right w-16">
                  <div className="h-5 bg-[var(--bg-sunken)] rounded animate-pulse w-12 ml-auto" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && activeTab === 'rankings' && entries.length === 0 && (
          <div className="text-center py-16 px-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--bg-sunken)] border border-[var(--border)] flex items-center justify-center">
              <span className="text-3xl">🏆</span>
            </div>
            <h3 className="text-lg font-semibold text-[var(--text)] mb-2">No debaters yet</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-sm mx-auto">
              {period === 'weekly'
                ? 'No debates completed this week. Be the first to climb the rankings!'
                : 'Complete a debate to appear on the rankings and earn points.'}
            </p>
            <Link
              href="/debate"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white font-medium text-sm hover:bg-[var(--accent-hover)] transition-colors"
            >
              <span>Start Debating</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        )}

        {/* Empty state Recent */}
        {!loading && !error && activeTab === 'recent' && publicDebates.length === 0 && (
          <div className="text-center py-16 px-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--bg-sunken)] border border-[var(--border)] flex items-center justify-center">
              <span className="text-3xl">💬</span>
            </div>
            <h3 className="text-lg font-semibold text-[var(--text)] mb-2">No public debates yet</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-sm mx-auto">
              Be the first to share your convictions with the world.
            </p>
            <Link
              href="/debate"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white font-medium text-sm hover:bg-[var(--accent-hover)] transition-colors"
            >
              <span>Start Debating</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        )}

        {/* Rankings entries */}
        {!loading && !error && activeTab === 'rankings' && entries.length > 0 && (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.userId}
                className={`flex items-center gap-3 p-3.5 sm:p-4 rounded-xl border transition-colors ${
                  entry.rank <= 3
                    ? 'bg-[var(--accent)]/3 border-[var(--accent)]/15'
                    : 'bg-[var(--bg-elevated)] border-[var(--border)]/50'
                }`}
              >
                {/* Rank */}
                <div className="flex-shrink-0 w-8 flex justify-center">
                  <RankBadge rank={entry.rank} />
                </div>

                {/* Name + stats */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {entry.username ? (
                      <Link
                        href={`/profile/${entry.username}`}
                        className="text-sm font-semibold text-[var(--text)] hover:text-[var(--accent)] transition-colors truncate"
                      >
                        {entry.displayName || `Debater ${entry.userId.slice(-4)}`}
                      </Link>
                    ) : (
                      <span className="text-sm font-semibold text-[var(--text)] truncate">
                        {entry.displayName || `Debater ${entry.userId.slice(-4)}`}
                      </span>
                    )}
                    {entry.currentStreak > 0 && (
                      <span className="text-xs text-orange-500 font-medium flex items-center gap-0.5">
                        🔥 {entry.currentStreak}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)] mt-0.5">
                    <span>{entry.totalDebates} {entry.totalDebates === 1 ? 'debate' : 'debates'}</span>
                    <span>·</span>
                    <span>{entry.totalWins}W</span>
                    <span>·</span>
                    <span>Avg {entry.avgScore}</span>
                  </div>
                </div>

                {/* Key stat (based on sort) */}
                <div className="flex-shrink-0 text-right">
                  {sort === 'points' && (
                    <div>
                      <span className="text-sm font-bold text-[var(--accent)] tabular-nums">{entry.totalPoints}</span>
                      <span className="text-[10px] text-[var(--text-tertiary)] ml-1">pts</span>
                    </div>
                  )}
                  {sort === 'streak' && (
                    <div>
                      <span className="text-sm font-bold text-orange-500 tabular-nums">{entry.currentStreak}</span>
                      <span className="text-[10px] text-[var(--text-tertiary)] ml-1">day{entry.currentStreak !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                  {sort === 'debates' && (
                    <div>
                      <span className="text-sm font-bold text-[var(--accent)] tabular-nums">{entry.totalDebates}</span>
                    </div>
                  )}
                  {sort === 'avg_score' && (
                    <div>
                      <span className="text-sm font-bold text-[var(--accent)] tabular-nums">{entry.avgScore}</span>
                      <span className="text-[10px] text-[var(--text-tertiary)] ml-1">avg</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recent entries */}
        {!loading && !error && activeTab === 'recent' && publicDebates.length > 0 && (
          <div className="grid grid-cols-1 gap-4">
            {publicDebates.map((debate) => (
              <Link
                key={debate.id}
                href={`/debates/${debate.id}`}
                className="group p-5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border)]/50 hover:border-[var(--accent)]/30 hover:bg-[var(--accent)]/[0.02] transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">
                    {debate.opponent}
                  </span>
                  <span className="text-[var(--text-tertiary)] text-xs">·</span>
                  <span className="text-[var(--text-secondary)] text-xs">
                    {new Date(debate.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <h4 className="text-base font-semibold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors mb-2 line-clamp-2">
                  {debate.topic}
                </h4>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-[var(--bg-sunken)] flex items-center justify-center text-[10px]">
                      👤
                    </div>
                    <span className="text-xs text-[var(--text-secondary)]">
                      {debate.author.displayName}
                    </span>
                  </div>
                  <div className="text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Points legend */}
      {activeTab === 'rankings' && (
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
      )}
    </div>
  );
}
