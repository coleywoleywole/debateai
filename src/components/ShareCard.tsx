'use client';

import React from 'react';
import { track } from "@/lib/analytics";

interface ShareCardProps {
  topic: string;
  userArgument: string;
  aiArgument: string;
  rounds: number;
  winner?: 'user' | 'ai' | 'draw';
  onClose: () => void;
}

/**
 * ShareCard Component
 * Displays a visually appealing summary of the debate for sharing.
 */
export default function ShareCard({
  topic,
  userArgument,
  aiArgument,
  rounds,
  winner,
  onClose
}: ShareCardProps) {
  
  const handleShare = async (platform: 'twitter' | 'copy') => {
    const shareText = `Just finished a debate on "${topic}"! ${winner === 'user' ? 'I won! 🏆' : winner === 'ai' ? 'The AI won this time. 🤖' : 'It was a draw! ⚖️'}\n\nCheck it out on DebateAI:`;
    const shareUrl = window.location.href;
    const debateId = window.location.pathname.split('/').pop() || "";

    if (platform === 'twitter') {
      const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
      window.open(url, '_blank');
      track('debate_shared', { method: 'twitter', debateId, source: 'modal' });
    } else {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      track('debate_shared', { method: 'copy_link', debateId, source: 'modal' });
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-[var(--bg-elevated)] border border-[var(--border)] rounded-3xl overflow-hidden shadow-2xl animate-scale-in">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-[var(--bg-sunken)] transition-colors text-[var(--text-tertiary)]"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Card Content - The part that looks like an image */}
        <div className="p-8 pb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent)] flex items-center justify-center text-white">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--text)] leading-tight">DebateAI</h2>
              <p className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-bold">Summary Card</p>
            </div>
          </div>

          <div className="space-y-6">
            <h1 className="text-2xl font-black text-[var(--text)] leading-tight tracking-tight">
              {topic}
            </h1>

            <div className="grid grid-cols-1 gap-4">
              <div className="p-4 rounded-2xl bg-[var(--bg-sunken)] border border-[var(--border)]/50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-[var(--accent)] uppercase tracking-wider">Your Final Word</span>
                </div>
                <p className="text-sm text-[var(--text)] line-clamp-3 italic">
                  "{userArgument}"
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--bg-sunken)] border border-[var(--border)]/50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-red-500 uppercase tracking-wider">AI's Final Word</span>
                </div>
                <p className="text-sm text-[var(--text)] line-clamp-3 italic">
                  "{aiArgument}"
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-[var(--text-tertiary)]">Duration</span>
                <span className="text-sm font-bold text-[var(--text)]">{rounds} Rounds</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase font-bold text-[var(--text-tertiary)]">Result</span>
                <span className={`text-sm font-bold ${winner === 'user' ? 'text-green-500' : winner === 'ai' ? 'text-red-500' : 'text-amber-500'}`}>
                  {winner === 'user' ? '🏆 Winner' : winner === 'ai' ? '🤖 AI Won' : '⚖️ Draw'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 bg-[var(--bg-sunken)] border-t border-[var(--border)] flex flex-col gap-3">
          <button
            onClick={() => handleShare('twitter')}
            className="w-full flex items-center justify-center gap-2 h-12 bg-[#1DA1F2] text-white rounded-xl font-bold transition-transform active:scale-95"
          >
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.84 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
            </svg>
            Post to X
          </button>
          <button
            onClick={() => handleShare('copy')}
            className="w-full h-12 border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text)] rounded-xl font-bold transition-all hover:bg-[var(--bg-sunken)] active:scale-95"
          >
            Copy Link
          </button>
        </div>
      </div>
    </div>
  );
}
