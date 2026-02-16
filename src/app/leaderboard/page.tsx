import { Metadata } from 'next';
import LeaderboardClient from './LeaderboardClient';
import Header from '@/components/Header';

export const metadata: Metadata = {
  title: 'Leaderboard — DebateAI',
  description: 'Top debaters ranked by points, streaks, debates, and average score. Weekly and all-time.',
  openGraph: {
    title: 'Leaderboard — DebateAI',
    description: 'See who the best debaters are. Points, streaks, and rankings.',
  },
};

export default function LeaderboardPage() {
  return (
    <div className="min-h-dvh flex flex-col">
      <Header />
      <main className="flex-1 px-5 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-[var(--text)] mb-2 px-1 break-words">
              🏆 Leaderboard
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Top debaters ranked by points, streaks, and skill.
            </p>
          </div>
          <LeaderboardClient />
        </div>
      </main>
    </div>
  );
}
