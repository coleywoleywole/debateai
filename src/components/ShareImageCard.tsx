'use client';

import { forwardRef } from 'react';

interface ShareImageCardProps {
  topic: string;
  userArgument: string;
  aiArgument: string;
  opponentName: string;
  winner?: 'user' | 'ai' | 'draw';
  userScore?: number;
  aiScore?: number;
}

const ShareImageCard = forwardRef<HTMLDivElement, ShareImageCardProps>(
  ({ topic, userArgument, aiArgument, opponentName, winner, userScore, aiScore }, ref) => {
    const winnerEmoji = winner === 'user' ? '🏆' : winner === 'ai' ? '😤' : '🤝';
    const winnerText = winner === 'user' ? 'You won!' : winner === 'ai' ? `${opponentName} wins` : "It's a draw!";

    return (
      <div
        ref={ref}
        className="w-[600px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 rounded-2xl shadow-2xl"
        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
      >
        {/* Header / Logo */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <span className="text-white font-bold text-lg">DebateAI</span>
          </div>
          <div className="text-orange-400 text-sm font-medium">debateai.org</div>
        </div>

        {/* Topic */}
        <div className="mb-6">
          <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Topic</div>
          <h2 className="text-white text-xl font-bold leading-tight">{topic}</h2>
        </div>

        {/* Winner Badge */}
        {winner && (
          <div className="flex items-center gap-2 mb-6 bg-white/10 rounded-xl px-4 py-3">
            <span className="text-2xl">{winnerEmoji}</span>
            <span className="text-white font-bold">{winnerText}</span>
            {userScore !== undefined && aiScore !== undefined && (
              <span className="ml-auto text-slate-300 text-sm">
                {userScore} - {aiScore}
              </span>
            )}
          </div>
        )}

        {/* Arguments */}
        <div className="space-y-4">
          {/* User Argument */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                <svg className="w-3 h-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <span className="text-blue-400 text-xs font-semibold uppercase tracking-wider">You</span>
            </div>
            <p className="text-slate-200 text-sm leading-relaxed line-clamp-4">{userArgument}</p>
          </div>

          {/* AI Argument */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center">
                <span className="text-orange-400 text-xs">🤖</span>
              </div>
              <span className="text-orange-400 text-xs font-semibold uppercase tracking-wider">{opponentName}</span>
            </div>
            <p className="text-slate-200 text-sm leading-relaxed line-clamp-4">{aiArgument}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
          <div className="text-slate-500 text-xs">
            Can you do better? Debate me at debateai.org
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
            </svg>
          </div>
        </div>
      </div>
    );
  }
);

ShareImageCard.displayName = 'ShareImageCard';

export default ShareImageCard;
