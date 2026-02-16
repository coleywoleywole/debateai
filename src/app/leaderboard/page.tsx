import { Metadata } from 'next';
import LeaderboardClient from './LeaderboardClient';
import Header from '@/components/Header';

export const metadata: Metadata = {
  title: 'Explore & Leaderboard — DebateAI',
  description: 'Discover top debates and ranked debaters. See who is leading the charts in logic and persuasion.',
  openGraph: {
    title: 'Explore & Leaderboard — DebateAI',
    description: 'See the best debates and top debaters. Rankings, streaks, and community highlights.',
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
              🏆 Explore
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Rankings, streaks, and top debates from the community.
            </p>
          </div>
          <LeaderboardClient />
        </div>
      </main>
    </div>
  );
}
