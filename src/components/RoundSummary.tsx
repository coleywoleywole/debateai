"use client";

import React from 'react';
import { track } from "@/lib/analytics";

interface RoundSummaryProps {
	round: number;
	nextRoundTitle: string;
	onAdvance: () => void;
	isLastRound?: boolean;
}

export default function RoundSummary({
	round,
	nextRoundTitle,
	onAdvance,
	isLastRound = false,
}: RoundSummaryProps) {
	function handleAdvance() {
		track('debate_round_advanced', {
			round,
			nextRound: round + 1,
		});
		onAdvance();
	}

	return (
		<div className="max-w-xl mx-auto px-4 py-8 animate-fade-in">
			<div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl p-6 text-center shadow-sm relative overflow-hidden group">
				<div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/5 to-transparent opacity-50" />
				
				<div className="relative z-10 flex flex-col items-center gap-3">
					<div className="w-12 h-12 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mb-1 text-2xl">
						{round === 1 ? '🎯' : round === 2 ? '⚔️' : '🏁'}
					</div>
					
					<h3 className="text-lg font-semibold text-[var(--text)]">
						Round {round} Complete
					</h3>
					
					<p className="text-sm text-[var(--text-secondary)] max-w-sm mx-auto mb-2">
						{isLastRound 
							? "You've completed all rounds. Ready to see the final verdict?" 
							: `Up next: ${nextRoundTitle}. Prepare your arguments!`}
					</p>
					
					<button
						onClick={handleAdvance}
						className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-all transform active:scale-95 font-medium shadow-md shadow-[var(--accent)]/20"
					>
						<span>{isLastRound ? "Finish Debate" : `Start ${nextRoundTitle}`}</span>
						<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
						</svg>
					</button>
				</div>
			</div>
		</div>
	);
}
