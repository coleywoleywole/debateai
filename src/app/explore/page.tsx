import { Metadata } from 'next';
import ExploreClient from './ExploreClient';
import Header from '@/components/Header';

export const metadata: Metadata = {
	title: 'Explore — DebateAI',
	description: 'Browse recent debates from the DebateAI community.',
};

export default function ExplorePage() {
	return (
		<div className="min-h-dvh flex flex-col relative overflow-hidden">
			<Header />
			<main className="flex-1 px-5 py-6 overflow-y-auto">
				<div className="max-w-2xl mx-auto">
					{/* Header */}
					<div className="mb-6">
						<div className="inline-flex items-center gap-2 mb-2">
							<span className="h-px w-4 bg-gradient-to-r from-transparent to-[var(--accent)] opacity-50" />
							<span className="text-[10px] font-medium text-[var(--accent)] uppercase tracking-[0.2em]">
								Public Debates
							</span>
						</div>
						<h1 className="text-2xl font-serif font-semibold text-[var(--text)]">Explore</h1>
						<p className="text-xs text-[var(--text-secondary)] mt-1">Discover debates from around the world</p>
					</div>
					<ExploreClient />
				</div>
			</main>
		</div>
	);
}
