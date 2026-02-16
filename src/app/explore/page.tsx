import { Metadata } from 'next';
import ExploreClient from './ExploreClient';
import Header from '@/components/Header';

export const metadata: Metadata = {
  title: 'Explore — DebateAI',
  description: 'Explore top debates and debaters ranked by points, streaks, and skill.',
  openGraph: {
    title: 'Explore — DebateAI',
    description: 'See the best debaters and most engaging debates.',
  },
};

export default function ExplorePage() {
  return (
    <div className="min-h-dvh flex flex-col">
      <Header />
      <main className="flex-1 px-5 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[var(--text)] mb-2">
              🧭 Explore
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Top debaters ranked by points, streaks, and skill.
            </p>
          </div>
          <ExploreClient />
        </div>
      </main>
    </div>
  );
}
