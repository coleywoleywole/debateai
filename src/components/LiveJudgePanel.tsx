"use client";

import { useState, useEffect, useRef } from "react";
import type { LiveJudgeFeedback } from "@/lib/live-judge";

interface LiveJudgePanelProps {
  feedbackHistory: LiveJudgeFeedback[];
  isLoading: boolean;
  currentScore: number | null;
  isMobileDrawerOpen: boolean;
  onMobileDrawerToggle: () => void;
  // Optional props for backward compatibility
  canRequestVerdict?: boolean;
  isJudging?: boolean;
  onRequestVerdict?: () => void;
}

// Simple inline icons
const CoachAvatar = () => (
  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white shadow-md">
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  </div>
);

const CheckIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const AlertIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const SparkleIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

// Score badge - compact
function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold text-white ${color}`}>
      {score}
    </span>
  );
}

// Single feedback bubble - chat style
function FeedbackBubble({ feedback, isLatest }: { feedback: LiveJudgeFeedback; isLatest?: boolean }) {
  return (
    <div className={`flex gap-3 ${isLatest ? 'animate-fade-in' : ''}`}>
      <div className="flex-shrink-0">
        <CoachAvatar />
      </div>
      
      <div className="flex-1 min-w-0">
        {/* Bubble */}
        <div className="bg-[var(--bg-elevated)] rounded-2xl rounded-tl-md px-4 py-3 shadow-sm border border-[var(--border)]/50">
          {/* Header: Score + Timestamp */}
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold text-sm text-[var(--text)]">Coach</span>
            <ScoreBadge score={feedback.overallScore} />
            {isLatest && <span className="text-[10px] text-emerald-500 font-medium">New</span>}
          </div>
          
          {/* Main tip */}
          <p className="text-[var(--text)] text-sm leading-relaxed mb-3">
            💡 {feedback.tip}
          </p>
          
          {/* Strengths */}
          {feedback.strengths.length > 0 && (
            <div className="space-y-1 mb-2">
              {feedback.strengths.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-emerald-500 mt-0.5"><CheckIcon /></span>
                  <span className="text-[var(--text-secondary)]">{s}</span>
                </div>
              ))}
            </div>
          )}
          
          {/* Weaknesses */}
          {feedback.weaknesses.length > 0 && (
            <div className="space-y-1">
              {feedback.weaknesses.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-amber-500 mt-0.5"><AlertIcon /></span>
                  <span className="text-[var(--text-secondary)]">{w}</span>
                </div>
              ))}
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
}

// Verdict prompt - appears as a coach message suggesting to end the debate
function VerdictPrompt({ isJudging, onRequestVerdict, canRequestVerdict }: {
  isJudging?: boolean;
  onRequestVerdict?: () => void;
  canRequestVerdict?: boolean;
}) {
  if (!canRequestVerdict) return null;

  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="flex-shrink-0">
        <CoachAvatar />
      </div>

      <div className="flex-1 min-w-0">
        <div className="bg-[var(--bg-elevated)] rounded-2xl rounded-tl-md px-4 py-3 shadow-sm border border-[var(--border)]/50">
          <p className="text-[var(--text-secondary)] text-xs leading-relaxed mb-2">
            Ready for the final score?
          </p>

          <button
            onClick={onRequestVerdict}
            disabled={isJudging}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-medium hover:bg-[var(--accent)]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isJudging ? (
              <>
                <span className="w-3 h-3 border-2 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin" />
                <span>Judging...</span>
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Request verdict</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Empty state - waiting for coach
function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 text-center">
      <CoachAvatar />
      <p className="mt-4 text-sm text-[var(--text-secondary)]">
        Your coach will message you after your second exchange
      </p>
    </div>
  );
}

// Loading state - typing indicator
function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <CoachAvatar />
      <div className="bg-[var(--bg-elevated)] rounded-2xl rounded-tl-md px-4 py-3 border border-[var(--border)]/50">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 bg-[var(--text-secondary)]/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-[var(--text-secondary)]/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-[var(--text-secondary)]/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

export function LiveJudgePanel({
  feedbackHistory,
  isLoading,
  currentScore,
  isMobileDrawerOpen,
  onMobileDrawerToggle,
  canRequestVerdict,
  isJudging,
  onRequestVerdict,
}: LiveJudgePanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasFeedback = feedbackHistory.length > 0;

  // Auto-scroll to bottom when new feedback arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [feedbackHistory.length]);

  return (
    <>
      {/* Desktop Panel */}
      <div className="hidden lg:flex flex-col h-full bg-[var(--bg-elevated)]/20">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-[var(--border)]/50 bg-[var(--bg)] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CoachAvatar />
            <div>
              <h2 className="font-semibold text-[var(--text)] text-sm">Debate Coach</h2>
              <p className="text-[10px] text-[var(--text-secondary)]">
                {isLoading ? "Typing..." : hasFeedback ? "Online" : "Waiting"}
              </p>
            </div>
          </div>
          {currentScore !== null && <ScoreBadge score={currentScore} />}
        </div>

        {/* Chat Thread */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {!hasFeedback && !isLoading ? (
            <EmptyState />
          ) : (
            <>
              {feedbackHistory.map((feedback, idx) => (
                <FeedbackBubble
                  key={idx}
                  feedback={feedback}
                  isLatest={idx === feedbackHistory.length - 1}
                />
              ))}
              {isLoading && <TypingIndicator />}
              <VerdictPrompt
                isJudging={isJudging}
                onRequestVerdict={onRequestVerdict}
                canRequestVerdict={canRequestVerdict}
              />
            </>
          )}
        </div>
      </div>

      {/* Mobile Floating Button */}
      <div className="lg:hidden">
        {!isMobileDrawerOpen && (
          <button
            onClick={onMobileDrawerToggle}
            className="fixed bottom-24 right-4 z-40 flex items-center gap-3 px-4 py-3 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] shadow-xl transition-transform hover:scale-105"
          >
            <CoachAvatar />
            <div className="text-left">
              <div className="text-xs text-[var(--text-secondary)]">Coach</div>
              <div className="text-sm font-semibold text-[var(--text)]">
                {hasFeedback ? `${currentScore}/100` : "Tap to open"}
              </div>
            </div>
            {hasFeedback && (
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            )}
          </button>
        )}

        {/* Mobile Drawer */}
        {isMobileDrawerOpen && (
          <>
            <div
              onClick={onMobileDrawerToggle}
              className="fixed inset-0 bg-black/50 z-40"
            />
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg)] rounded-t-3xl border-t border-[var(--border)] shadow-2xl max-h-[85vh] flex flex-col animate-slide-up"
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-12 h-1.5 rounded-full bg-[var(--border)]" />
              </div>
              
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                <div className="flex items-center gap-3">
                  <CoachAvatar />
                  <div>
                    <h2 className="font-semibold text-[var(--text)]">Debate Coach</h2>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {isLoading ? "Typing..." : hasFeedback ? "Online" : "Waiting"}
                    </p>
                  </div>
                </div>
                <button onClick={onMobileDrawerToggle} className="p-2">
                  <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {!hasFeedback && !isLoading ? (
                  <EmptyState />
                ) : (
                  <>
                    {feedbackHistory.map((feedback, idx) => (
                      <FeedbackBubble
                        key={idx}
                        feedback={feedback}
                        isLatest={idx === feedbackHistory.length - 1}
                      />
                    ))}
                    {isLoading && <TypingIndicator />}
                    <VerdictPrompt
                      isJudging={isJudging}
                      onRequestVerdict={onRequestVerdict}
                      canRequestVerdict={canRequestVerdict}
                    />
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.25s ease-out;
        }
      `}</style>
    </>
  );
}
