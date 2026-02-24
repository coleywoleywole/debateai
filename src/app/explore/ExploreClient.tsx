'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { HistoryPageSkeleton } from '@/components/Skeleton';

interface PublicDebate {
	id: string;
	opponent: string;
	topic: string;
	status: string;
	messageCount: number;
	createdAt: string;
	author: {
		username: string | null;
		displayName: string;
	};
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
	return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function isLive(debate: PublicDebate): boolean {
	if (debate.status !== 'active') return false;
	const createdAt = new Date(debate.createdAt).getTime();
	const thirtyMinAgo = Date.now() - 30 * 60_000;
	return createdAt > thirtyMinAgo;
}

export default function ExploreClient() {
	const router = useRouter();
	const [debates, setDebates] = useState<PublicDebate[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchData = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await fetch('/api/debates/public?limit=30');
			if (!res.ok) throw new Error('Failed to load');
			const data = await res.json();
			setDebates(data.debates);
		} catch {
			setError('Failed to load debates');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	if (loading) {
		return <HistoryPageSkeleton />;
	}

	if (error) {
		return (
			<div className="text-center py-12">
				<div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
					<svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
					</svg>
				</div>
				<p className="text-sm text-[var(--text-secondary)] mb-4">{error}</p>
				<button
					onClick={() => { setLoading(true); fetchData(); }}
					className="h-9 px-4 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
				>
					Try Again
				</button>
			</div>
		);
	}

	if (debates.length === 0) {
		return (
			<div className="text-center py-16">
				<div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border)]/30 flex items-center justify-center">
					<svg className="w-6 h-6 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
					</svg>
				</div>
				<h3 className="text-base font-medium text-[var(--text)] mb-1">No debates yet</h3>
				<p className="text-sm text-[var(--text-secondary)] mb-5">Be the first to start a debate and share it with the community</p>
				<Link
					href="/"
					className="h-9 px-5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium inline-flex items-center gap-2 shadow-lg shadow-[var(--accent)]/25 hover:shadow-xl hover:shadow-[var(--accent)]/40 transition-all"
				>
					Start Your First Debate
				</Link>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{debates.map((debate, index) => (
				<div
					key={debate.id}
					onClick={() => router.push(`/debate/${debate.id}`)}
					className="group relative cursor-pointer animate-fade-up"
					style={{ animationDelay: `${index * 50}ms` }}
				>
					{/* Glow on hover */}
					<div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--accent)]/0 to-[var(--accent)]/0 group-hover:from-[var(--accent)]/10 group-hover:to-[var(--accent-light)]/10 rounded-xl blur opacity-0 group-hover:opacity-100 transition-all duration-300" />

					<div className="relative artistic-card p-4 hover:border-[var(--accent)]/30 transition-all duration-300">
						<div className="flex items-start justify-between gap-4">
							<div className="flex-1 min-w-0">
								<h3 className="font-medium text-[var(--text)] text-sm mb-1.5 line-clamp-2 group-hover:text-[var(--accent)] transition-colors">
									{debate.topic}
								</h3>

								<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]">
									{isLive(debate) && (
										<span className="inline-flex items-center gap-1.5 text-emerald-600 font-medium">
											<span className="relative flex h-1.5 w-1.5">
												<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
												<span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
											</span>
											LIVE
										</span>
									)}
									<span className="inline-flex items-center gap-1.5">
										<span className="w-1 h-1 rounded-full bg-[var(--accent)]" />
										vs {debate.opponent}
									</span>
									<span className="flex items-center gap-1">
										<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
										</svg>
										{debate.author.displayName}
									</span>
									{debate.messageCount > 0 && (
									<span className="flex items-center gap-1">
										<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
										</svg>
										{debate.messageCount} msg{debate.messageCount !== 1 ? 's' : ''}
									</span>
								)}
								<span className="flex items-center gap-1">
										<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
										</svg>
										{timeAgo(debate.createdAt)}
									</span>
								</div>
							</div>

							<div className="flex-shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity">
								<div className="w-7 h-7 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center">
									<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
									</svg>
								</div>
							</div>
						</div>
					</div>
				</div>
			))}
		</div>
	);
}
