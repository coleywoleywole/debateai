"use client";

import { useState } from "react";
import type { DebateScore } from "@/lib/scoring";

interface JudgeMessageProps {
  score: DebateScore;
  opponentName?: string;
  onViewFullAnalysis?: () => void;
  // Share Image feature props
  messageCount?: number;
  messages?: Array<{ role: string; content: string }>;
  topic?: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  logic: "🧠",
  evidence: "📚",
  persuasion: "🎯",
  clarity: "✨",
  rebuttal: "⚔️",
};

const CATEGORY_LABELS: Record<string, string> = {
  logic: "Logic",
  evidence: "Evidence",
  persuasion: "Persuasion",
  clarity: "Clarity",
  rebuttal: "Rebuttal",
};

export default function JudgeMessage({
  score,
  opponentName = "AI",
  onViewFullAnalysis,
  messageCount,
  messages,
  topic,
}: JudgeMessageProps) {
  const [showDetails, setShowDetails] = useState(false);

  const winnerEmoji = score.winner === "user" ? "🏆" : score.winner === "ai" ? "😤" : "🤝";
  const winnerText =
    score.winner === "user"
      ? "You won this debate"
      : score.winner === "ai"
        ? `${opponentName} won this debate`
        : "This debate is a draw";

  return (
    <div className="py-5 bg-[var(--bg-elevated)]/30 border-y border-[var(--accent)]/20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="flex gap-3">
          {/* Judge Avatar */}
          <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-500 border border-amber-500/30">
            ⚖️
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 pt-0.5">
            {/* Name */}
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm text-amber-500">Judge</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-medium">
                AI Scored
              </span>
            </div>

            {/* Winner Announcement */}
            <div className="mb-3">
              <div className="flex items-center gap-2 text-[15px] text-[var(--text)]">
                <span className="text-xl">{winnerEmoji}</span>
                <span className="font-medium">{winnerText}</span>
              </div>
            </div>

            {/* Score Breakdown */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              {Object.entries(score.categories).slice(0, 3).map(([key, val]) => (
                <div
                  key={key}
                  className="bg-[var(--bg-sunken)]/50 rounded-lg p-2.5 text-center border border-[var(--border)]/30"
                >
                  <div className="text-xs mb-1">{CATEGORY_ICONS[key]} {CATEGORY_LABELS[key]}</div>
                  <div className="flex items-center justify-center gap-1.5 text-sm">
                    <span className="font-semibold text-[var(--accent)]">{val.user}</span>
                    <span className="text-[var(--text-tertiary)]">/</span>
                    <span className="font-semibold text-orange-400">{val.ai}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Commentary */}
            <p className="text-[14px] leading-relaxed text-[var(--text-secondary)] mb-3">
              {score.summary}
            </p>

            {/* View Full Analysis Link */}
            <button
              onClick={() => {
                setShowDetails(!showDetails);
                onViewFullAnalysis?.();
              }}
              className="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors flex items-center gap-1"
            >
              <span>{showDetails ? "Hide details" : "See full analysis"}</span>
              <svg
                className={`w-3.5 h-3.5 transition-transform duration-200 ${showDetails ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Expanded Details */}
            {showDetails && (
              <div className="mt-4 pt-4 border-t border-[var(--border)]/50 space-y-3 animate-in slide-in-from-top-2 duration-200">
                {/* Overall Scores */}
                <div className="flex items-center justify-center gap-6 py-2">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[var(--accent)]">{score.userScore}</div>
                    <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">You</div>
                  </div>
                  <div className="text-xs text-[var(--text-tertiary)]">vs</div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-400">{score.aiScore}</div>
                    <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">{opponentName}</div>
                  </div>
                </div>

                {/* All Categories */}
                <div className="space-y-2">
                  {Object.entries(score.categories).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-xs text-[var(--text-secondary)] w-20">{CATEGORY_LABELS[key]}</span>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 bg-[var(--bg-sunken)] rounded-full h-1.5 overflow-hidden flex justify-end">
                          <div
                            className="h-full bg-[var(--accent)] rounded-full"
                            style={{ width: `${(val.user / 10) * 100}%` }}
                          />
                        </div>
                        <div className="flex-1 bg-[var(--bg-sunken)] rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full bg-orange-400 rounded-full"
                            style={{ width: `${(val.ai / 10) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs w-16 justify-end">
                        <span className="font-medium text-[var(--accent)]">{val.user}</span>
                        <span className="text-[var(--text-tertiary)]">/</span>
                        <span className="font-medium text-orange-400">{val.ai}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Strengths & Key Moment */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                  <div className="bg-[var(--bg-sunken)]/50 rounded-lg p-3 border border-[var(--border)]/30">
                    <div className="text-[10px] text-[var(--accent)] uppercase tracking-wider mb-1 font-medium">Your Strength</div>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{score.userStrength}</p>
                  </div>
                  <div className="bg-[var(--bg-sunken)]/50 rounded-lg p-3 border border-[var(--border)]/30">
                    <div className="text-[10px] text-orange-400 uppercase tracking-wider mb-1 font-medium">{opponentName}&apos;s Strength</div>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{score.aiStrength}</p>
                  </div>
                </div>

                {score.keyMoment && (
                  <div className="bg-[var(--bg-sunken)]/50 rounded-lg p-3 border border-[var(--border)]/30">
                    <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1 font-medium">💥 Key Moment</div>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{score.keyMoment}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
