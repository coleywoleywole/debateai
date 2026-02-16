'use client';

import Link from 'next/link';
import type { PublicProfileData } from '@/lib/profiles';

interface Props {
  initialProfile: PublicProfileData | null;
  username: string;
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="text-center p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)]/50">
      <div className="text-lg mb-0.5">{icon}</div>
      <div className="text-lg font-bold text-[var(--text)] tabular-nums">{value}</div>
      <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">{label}</div>
    </div>
  );
}

function WinnerBadge({ winner }: { winner: string | null }) {
  if (!winner) return null;
  const config: Record<string, { emoji: string; cls: string }> = {
    user: { emoji: '🏆', cls: 'text-green-500' },
    ai: { emoji: '🤖', cls: 'text-orange-500' },
    draw: { emoji: '🤝', cls: 'text-blue-500' },
  };
  const c = config[winner] || config.draw;
  return <span className={`text-sm ${c.cls}`}>{c.emoji}</span>;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffHr = Math.floor(diffMs / 3_600_000);
  if (diffHr < 1) return 'just now';
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ProfileClient({ initialProfile, username }: Props) {
  if (!initialProfile) {
    return (
      <div className="text-center py-16">
        <div className="text-4xl mb-3">🔒</div>
        <h2 className="text-xl font-semibold text-[var(--text)] mb-2">Profile not found</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          @{username} doesn&apos;t exist or is set to private.
        </p>
        <Link
          href="/explore"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
        >
          View Leaderboard →
        </Link>
      </div>
    );
  }

  const p = initialProfile;
  const winRate = p.totalDebates > 0 ? Math.round((p.totalWins / p.totalDebates) * 100) : 0;

  return (
    <div className="animate-fade-up">
      {/* Profile header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-[var(--accent)]/10 flex items-center justify-center text-2xl">
          {p.displayName.charAt(0).toUpperCase()}
        </div>
        <h1 className="text-2xl font-serif font-bold text-[var(--text)]">
          {p.displayName}
        </h1>
        <p className="text-xs text-[var(--text-tertiary)] mt-1">@{p.username}</p>
        {p.bio && (
          <p className="text-sm text-[var(--text-secondary)] mt-2 max-w-md mx-auto">
            {p.bio}
          </p>
        )}
        <p className="text-[11px] text-[var(--text-tertiary)] mt-2">
          Member since {new Date(p.memberSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard icon="💬" label="Debates" value={p.totalDebates} />
        <StatCard icon="🏆" label="Win Rate" value={`${winRate}%`} />
        <StatCard icon="🔥" label="Streak" value={p.currentStreak} />
        <StatCard icon="⭐" label="Points" value={p.totalPoints} />
      </div>

      {/* Detailed stats */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="text-center p-2">
          <div className="text-sm font-semibold text-green-500 tabular-nums">{p.totalWins}W</div>
          <div className="text-[10px] text-[var(--text-tertiary)]">Wins</div>
        </div>
        <div className="text-center p-2">
          <div className="text-sm font-semibold text-orange-500 tabular-nums">{p.totalLosses}L</div>
          <div className="text-[10px] text-[var(--text-tertiary)]">Losses</div>
        </div>
        <div className="text-center p-2">
          <div className="text-sm font-semibold text-blue-500 tabular-nums">{p.totalDraws}D</div>
          <div className="text-[10px] text-[var(--text-tertiary)]">Draws</div>
        </div>
      </div>

      {/* Challenge CTA */}
      <div className="mb-8 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] shadow-lg shadow-[var(--accent)]/25 transition-all hover:-translate-y-0.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Challenge This Debater
        </Link>
      </div>

      {/* Recent debates */}
      {p.recentDebates.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-secondary)]">
              Recent Debates
            </span>
            <span className="h-px flex-1 bg-[var(--border)]" />
          </div>

          <div className="space-y-2">
            {p.recentDebates.map((debate) => (
              <Link
                key={debate.id}
                href={`/debate/${debate.id}`}
                className="flex items-center gap-3 p-3.5 rounded-xl border border-[var(--border)]/50 bg-[var(--bg-elevated)] hover:border-[var(--accent)]/30 transition-all group"
              >
                <WinnerBadge winner={debate.winner} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text)] group-hover:text-[var(--accent)] transition-colors truncate">
                    {debate.topic}
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-[var(--text-tertiary)] mt-0.5">
                    {debate.opponent && <span>vs {debate.opponent}</span>}
                    <span>{debate.userScore}–{debate.aiScore}</span>
                  </div>
                </div>
                <span className="text-[11px] text-[var(--text-tertiary)] flex-shrink-0">
                  {timeAgo(debate.createdAt)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {p.recentDebates.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-[var(--text-secondary)]">No scored debates yet.</p>
        </div>
      )}
    </div>
  );
}
