"use client";

import { useState, useEffect, useRef, memo, lazy, Suspense, useCallback, useMemo } from "react";
import React from "react";
import { useSafeUser } from "@/lib/useSafeClerk";
import { useParams, useSearchParams } from "next/navigation";
import { getOpponentById } from "@/lib/opponents";
import Header from "@/components/Header";
import { track } from "@/lib/analytics";
import { useToast } from "@/components/Toast";
import PostDebateEngagement from "@/components/PostDebateEngagement";
import { DebatePageSkeleton } from "@/components/Skeleton";
import { LiveJudgePanel } from "@/components/LiveJudgePanel";
import type { DebateScore } from "@/lib/scoring";
import type { LiveJudgeFeedback, LiveJudgeHighlight } from "@/lib/live-judge";

// Lazy load modals - they're only shown on user interaction
const UpgradeModal = lazy(() => import("@/components/UpgradeModal"));
const ShareModal = lazy(() => import("@/components/ShareModal"));

export interface DebateClientProps {
  initialDebate?: {
    id: string;
    topic: string;
    opponent?: string;
    character?: string;
    opponentStyle?: string;
    messages?: Array<{ role: string; content: string; citations?: any[]; failed?: boolean }>;
    isOwner?: boolean;
    score_data?: DebateScore | null;
    public?: boolean;
  } | null;
  initialMessages?: Array<{ role: string; content: string; citations?: any[]; failed?: boolean }>;
  initialIsOwner?: boolean;
}

// Message component with share per message and text highlighting
const Message = memo(({
  msg,
  opponent,
  debate,
  isAILoading,
  isUserLoading,
  onRetry,
  messageIndex,
  isHighlighted,
  debateId,
  variant,
  highlights
}: {
  msg: { role: string; content: string; citations?: any[]; failed?: boolean };
  opponent: any;
  debate: any;
  isAILoading?: boolean;
  isUserLoading?: boolean;
  onRetry?: () => void;
  messageIndex: number;
  isHighlighted?: boolean;
  debateId: string;
  variant: 'default' | 'aggressive';
  highlights?: LiveJudgeHighlight[];
}) => {
  const isUser = msg.role === "user";
  const isFailed = msg.failed;
  const [showShareToast, setShowShareToast] = useState(false);
  const [showCitations, setShowCitations] = useState(false);
  const [highlightedCitation, setHighlightedCitation] = useState<number | null>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  const citationRefs = useRef<Record<number, HTMLAnchorElement>>({});

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/debate/${debateId}?message=${messageIndex}`;
    try {
      await navigator.clipboard.writeText(url);
      setShowShareToast(true);
      setTimeout(() => setShowShareToast(false), 2000);
    } catch {}
  };

  const handleCitationClick = useCallback((citationId: number) => {
    if (!showCitations) setShowCitations(true);
    setHighlightedCitation(citationId);
    setTimeout(() => {
      const citationEl = citationRefs.current[citationId];
      if (citationEl) citationEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
    setTimeout(() => setHighlightedCitation(null), 2000);
  }, [showCitations]);

  // Render inline citation markers [N] as clickable superscripts
  const renderWithCitations = (text: string) => {
    if (!msg.citations || msg.citations.length === 0) return <>{text}</>;
    const parts = text.split(/(\[\d+\])/g);
    return <>{parts.map((part, i) => {
      const match = part.match(/^\[(\d+)\]$/);
      if (match) {
        const id = parseInt(match[1], 10);
        return (
          <button
            key={i}
            onClick={() => handleCitationClick(id)}
            className="inline-flex items-center justify-center text-[10px] font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)] cursor-pointer align-super ml-0.5 -mr-0.5 min-w-0 p-0 bg-transparent border-none"
          >
            [{id}]
          </button>
        );
      }
      return <span key={i}>{part}</span>;
    })}</>;
  };

  // Render message content with highlights
  const renderContent = () => {
    if (!highlights || highlights.length === 0 || !isUser) {
      return renderWithCitations(msg.content);
    }

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const sortedHighlights = [...highlights].sort((a, b) => msg.content.indexOf(a.text) - msg.content.indexOf(b.text));

    sortedHighlights.forEach((highlight, idx) => {
      const startIndex = msg.content.indexOf(highlight.text, lastIndex);
      if (startIndex === -1) return;

      // Add text before highlight
      if (startIndex > lastIndex) {
        parts.push(<span key={`text-${idx}`}>{msg.content.slice(lastIndex, startIndex)}</span>);
      }

      // Add highlighted text with subtle underline + tooltip on hover
      const isPositive = highlight.type === 'strong' || highlight.type === 'good-evidence';
      const isFallacy = highlight.type === 'fallacy';
      parts.push(
        <span
          key={`highlight-${idx}`}
          className={`cursor-help relative group/highlight decoration-2 underline underline-offset-4 ${
            isPositive
              ? 'decoration-emerald-400/60'
              : isFallacy
              ? 'decoration-red-400/60'
              : 'decoration-amber-400/60'
          }`}
        >
          {highlight.text}
          {/* Tooltip */}
          <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] shadow-xl text-xs opacity-0 invisible group-hover/highlight:opacity-100 group-hover/highlight:visible transition-all z-50 min-w-[200px] max-w-[280px] whitespace-normal text-left leading-relaxed">
            <span className={`font-medium block mb-0.5 ${
              isPositive ? 'text-emerald-500' : isFallacy ? 'text-red-500' : 'text-amber-500'
            }`}>
              {isPositive ? 'Strong point' : isFallacy ? 'Watch out' : 'Could improve'}
            </span>
            <span className="text-[var(--text-secondary)]">{highlight.comment}</span>
            <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[var(--bg-elevated)]" />
          </span>
        </span>
      );

      lastIndex = startIndex + highlight.text.length;
    });

    // Add remaining text
    if (lastIndex < msg.content.length) {
      parts.push(<span key="text-end">{msg.content.slice(lastIndex)}</span>);
    }

    return <>{parts}</>;
  };

  return (
    <div
      ref={messageRef}
      id={`message-${messageIndex}`}
      className={`py-6 relative group animate-message-in ${isHighlighted ? 'animate-highlight-pulse' : ''}`}
    >
      {isHighlighted && <div className="absolute inset-0 bg-[var(--accent)]/5 pointer-events-none" />}

      {showShareToast && (
        <div className="absolute top-2 right-4 z-10 px-3 py-1.5 rounded-full bg-[var(--accent)] text-white text-xs font-medium shadow-lg animate-fade-in">
          Link copied!
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className={`flex gap-4 ${isUser ? 'flex-row' : 'flex-row'}`}>
          {/* Avatar */}
          <div className={`flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center text-lg shadow-sm
            ${isFailed
              ? 'bg-red-500/10 text-red-500 border border-red-500/20'
              : isUser
                ? 'bg-[var(--accent)] text-white shadow-[var(--accent)]/20'
                : 'bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text)]'
            }`}
          >
            {isUser ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
            ) : (
              <span>{opponent?.avatar || "🤖"}</span>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
              <span className={`font-semibold text-sm ${isUser ? 'text-[var(--text)]' : 'text-[var(--text)]'}`}>
                {isUser ? "You" : opponent?.name || debate?.opponentStyle || "AI"}
              </span>
              <span className="text-xs text-[var(--text-secondary)]">
                {isUser ? "" : opponent?.title || ""}
              </span>
              {!isUser && (
                <button
                  onClick={handleShare}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
                  title="Share this message"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
                  </svg>
                </button>
              )}
            </div>

            {/* Message Content */}
            <div className={`text-[var(--text)] leading-relaxed ${isFailed ? 'text-red-400' : ''}`}>
              {renderContent()}
              {isAILoading && (
                <span className="inline-flex ml-1">
                  <span className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}/>
                  <span className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-bounce ml-0.5" style={{ animationDelay: '150ms' }}/>
                  <span className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-bounce ml-0.5" style={{ animationDelay: '300ms' }}/>
                </span>
              )}
              {isUserLoading && isUser && (
                <span className="inline-flex ml-1">
                  <span className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}/>
                  <span className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-bounce ml-0.5" style={{ animationDelay: '150ms' }}/>
                  <span className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-bounce ml-0.5" style={{ animationDelay: '300ms' }}/>
                </span>
              )}
            </div>

            {/* Citations Button */}
            {msg.citations && msg.citations.length > 0 && (
              <div className="mt-3">
                <button
                  onClick={() => setShowCitations(!showCitations)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/30 transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  {showCitations ? 'Hide sources' : `View ${msg.citations.length} source${msg.citations.length > 1 ? 's' : ''}`}
                </button>
              </div>
            )}

            {/* Citations Panel */}
            {showCitations && msg.citations && msg.citations.length > 0 && (
              <div className="mt-3 p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Sources</span>
                  <button
                    onClick={() => setShowCitations(false)}
                    className="text-[var(--text-secondary)] hover:text-[var(--text)]"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {msg.citations.map((citation: any) => (
                    <a
                      key={citation.id}
                      ref={(el) => { citationRefs.current[citation.id] = el!; }}
                      href={citation.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-sunken)]
                        text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] border border-[var(--border)]
                        ${highlightedCitation === citation.id ? 'ring-2 ring-[var(--accent)] bg-[var(--accent)]/10' : ''}`}
                    >
                      <span className="font-semibold text-[var(--accent)]">[{citation.id}]</span>
                      <span className="truncate max-w-[140px]">{citation.title || new URL(citation.url).hostname}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Retry button for failed messages */}
            {isFailed && onRetry && (
              <button
                onClick={onRetry}
                className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm hover:bg-red-500/20 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
Message.displayName = "Message";

export default function DebateClient({ initialDebate = null, initialMessages = [], initialIsOwner = false }: DebateClientProps = {}) {
  const params = useParams();
  const searchParams = useSearchParams();
  const { user, isSignedIn, isLoaded: isAuthLoaded } = useSafeUser();
  const { showToast } = useToast();
  const debateId = params.debateId as string;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [debate, setDebate] = useState<any>(initialDebate);
  const [messages, setMessages] = useState<any[]>(initialMessages);
  const [isOwner, setIsOwner] = useState<boolean>(initialIsOwner);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [debateAuthor, setDebateAuthor] = useState<{ username: string | null; displayName: string } | null>(null);
  const [userInput, setUserInput] = useState("");
  const instantDebateActiveRef = useRef(false);
  const hasUserSentMessage = useRef(false);
  const [isLoadingDebate, setIsLoadingDebate] = useState(!initialDebate);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isAILoading, setIsAILoading] = useState(false);
  const [isUserLoading, setIsUserLoading] = useState(false);
  const [isAITakeoverLoading, setIsAITakeoverLoading] = useState(false);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [rateLimitData, setRateLimitData] = useState<{ current: number; limit: number } | undefined>();
  const [debateScore, setDebateScore] = useState<DebateScore | null>(null);
  const variant: 'default' | 'aggressive' = 'default';
  const [showGuestLimitModal, setShowGuestLimitModal] = useState(false);
  const [isGuestOwner, setIsGuestOwner] = useState(false);
  const [isJudging, setIsJudging] = useState(false);
  const isDevMode = searchParams.get('dev') === 'true';
  const pendingTakeoverCitations = useRef<any[]>([]);

  // Resizable coach panel
  const [coachWidth, setCoachWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 360;
    const saved = sessionStorage.getItem('coachPanelWidth');
    return saved ? Math.max(240, Math.min(600, Number(saved))) : 360;
  });
  const isResizing = useRef(false);

  // Live Judge state
  const [liveFeedbackHistory, setLiveFeedbackHistory] = useState<LiveJudgeFeedback[]>([]);
  const [runningSummary, setRunningSummary] = useState<string>('');
  const [isLiveJudgeLoading, setIsLiveJudgeLoading] = useState(false);
  // Cross-highlight: which exchange (feedback index) is being hovered
  const [highlightedExchange, setHighlightedExchange] = useState<number | null>(null);
  const [showLiveJudgeDrawer, setShowLiveJudgeDrawer] = useState(false);
  const liveJudgeAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isSignedIn && (isDevMode || (debateId && sessionStorage.getItem('guest_debate_id') === debateId))) {
      setIsGuestOwner(true);
    }
  }, [debateId, isSignedIn, isDevMode]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasUserInteracted = useRef(false);

  const requestJudgment = useCallback(async () => {
    if (!debate || messages.length < 4 || isJudging) return;
    setIsJudging(true);
    track('debate_judge_requested', { debateId, messageCount: messages.length });

    try {
      const response = await fetch('/api/debate/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ debateId }),
      });

      if (!response.ok) return;

      const data = await response.json();
      setDebateScore(data.score);
      track('debate_scored', { debateId, userScore: data.score.userScore, aiScore: data.score.aiScore, winner: data.score.winner });
    } catch (e) {
      console.error('Failed to request judgment:', e);
    } finally {
      setIsJudging(false);
    }
  }, [debate, messages, debateId, isJudging]);

  // Fetch live judge feedback
  const fetchLiveJudgeFeedback = useCallback(async (userMsg: string, aiMsg: string) => {
    if (liveJudgeAbortRef.current) liveJudgeAbortRef.current.abort();
    const controller = new AbortController();
    liveJudgeAbortRef.current = controller;
    setIsLiveJudgeLoading(true);
    try {
      const res = await fetch('/api/debate/judge/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          debateId,
          topic: debate?.topic,
          latestExchange: { user: userMsg, ai: aiMsg },
          runningSummary: runningSummary || undefined,
        }),
        signal: controller.signal,
      });
      if (!res.ok) return;
      const data = await res.json();
      setLiveFeedbackHistory(prev => [...prev, data.feedback]);
      setRunningSummary(data.feedback.debateSummarySoFar || '');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') console.error('Live judge error:', e);
    } finally {
      setIsLiveJudgeLoading(false);
    }
  }, [debateId, debate?.topic, runningSummary]);

  // Auto-scroll effect — follows streaming content, uses smooth scroll for new messages
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !isAutoScrollEnabled) return;

    // During active streaming, use instant scroll to keep up with chunks
    // For new messages (not streaming), use smooth scroll
    const isStreaming = isAILoading || isUserLoading;
    if (isStreaming) {
      container.scrollTop = container.scrollHeight;
    } else if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isAILoading, isUserLoading, isAutoScrollEnabled]);

  // Detect user scroll — unlock when scrolling up, re-lock when near bottom
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

    if (isNearBottom) {
      // User scrolled back to bottom — re-enable auto-scroll
      hasUserInteracted.current = false;
      setIsAutoScrollEnabled(true);
    } else {
      // User scrolled up — disable auto-scroll
      hasUserInteracted.current = true;
      setIsAutoScrollEnabled(false);
    }
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Focus input on load
  useEffect(() => {
    if (!isLoadingDebate && textareaRef.current && !isDevMode) {
      textareaRef.current.focus();
    }
  }, [isLoadingDebate, isDevMode]);

  // Load debate data and check ownership
  // Always fetch from API to get correct isOwner (SSR can't check auth cookies)
  useEffect(() => {
    if (isDevMode) return;

    async function loadDebate() {
      try {
        const res = await fetch(`/api/debate/${debateId}`);
        if (!res.ok) throw new Error('Failed to load debate');
        const data = await res.json();
        // Always update ownership and auth state from authenticated API call
        setIsOwner(data.isOwner);
        setIsAuthenticated(data.isAuthenticated);
        if (data.debate.author) {
          setDebateAuthor(data.debate.author);
        }
        // Only update debate/messages if the user hasn't started sending messages.
        // Otherwise this fetch can resolve after handleSend and clobber optimistic state.
        if (!hasUserSentMessage.current) {
          setDebate(data.debate);
          setMessages(data.debate.messages || []);
          if (data.debate.score_data?.debateScore) {
            setDebateScore(data.debate.score_data.debateScore);
          }
          // Restore coach feedback history from D1
          if (Array.isArray(data.debate.score_data?.coachFeedback) && data.debate.score_data.coachFeedback.length > 0) {
            setLiveFeedbackHistory(data.debate.score_data.coachFeedback);
            const lastFeedback = data.debate.score_data.coachFeedback[data.debate.score_data.coachFeedback.length - 1];
            if (lastFeedback.debateSummarySoFar) {
              setRunningSummary(lastFeedback.debateSummarySoFar);
            }
          }
        }
      } catch (e) {
        // Only set error if we don't have SSR data to fall back on
        if (!initialDebate) {
          setLoadError(e instanceof Error ? e.message : 'Unknown error');
        }
      } finally {
        setIsLoadingDebate(false);
      }
    }

    loadDebate();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- initialDebate is from SSR and never changes; we intentionally always fetch fresh data
  }, [debateId, isDevMode]);

  // Poll for new messages when viewing someone else's debate (view-only mode)
  useEffect(() => {
    if (isOwner || isGuestOwner || isDevMode || isLoadingDebate) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/debate/${debateId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.debate) {
          const newMessages = data.debate.messages || [];
          // Only update if message count changed
          if (newMessages.length !== messages.length) {
            setMessages(newMessages);
            setDebate(data.debate);
            if (data.debate.score_data?.debateScore) {
              setDebateScore(data.debate.score_data.debateScore);
            }
            if (Array.isArray(data.debate.score_data?.coachFeedback) && data.debate.score_data.coachFeedback.length > 0) {
              setLiveFeedbackHistory(data.debate.score_data.coachFeedback);
            }
          }
        }
      } catch {
        // Silently ignore polling errors
      }
    };

    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [debateId, isOwner, isGuestOwner, isDevMode, isLoadingDebate, messages.length]);

  // Dev mode mock data
  useEffect(() => {
    if (!isDevMode) return;

    setDebate({
      id: debateId,
      topic: "Should AI be regulated?",
      opponentStyle: "Elon Musk",
      character: "elon",
      messages: [
        { role: "user", content: "I think AI should be regulated to ensure safety." },
        { role: "ai", content: "That's a bold claim. I disagree - regulation stifles innovation and free markets self-correct." }
      ]
    });
    setMessages([
      { role: "user", content: "I think AI should be regulated to ensure safety." },
      { role: "ai", content: "That's a bold claim. I disagree - regulation stifles innovation and free markets self-correct." }
    ]);
    setIsLoadingDebate(false);
  }, [isDevMode, debateId]);

  // Message highlight from URL
  const highlightedMessageIndex = useMemo(() => {
    const idx = searchParams.get('message');
    return idx ? parseInt(idx, 10) : null;
  }, [searchParams]);

  // Scroll to highlighted message
  useEffect(() => {
    if (highlightedMessageIndex !== null) {
      setTimeout(() => {
        const el = document.getElementById(`message-${highlightedMessageIndex}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);
    }
  }, [highlightedMessageIndex]);

  const opponent = useMemo(() => {
    if (!debate?.character) return null;
    return getOpponentById(debate.character);
  }, [debate]);

  // Handle sending a message
  const handleSend = useCallback(async (customInput?: string) => {
    const inputToSend = customInput ?? userInput;
    if (!inputToSend.trim() || isUserLoading || isAILoading) return;

    hasUserInteracted.current = false;
    hasUserSentMessage.current = true;
    setIsAutoScrollEnabled(true);

    // Add user message immediately (attach takeover citations if present)
    const takeoverCits = pendingTakeoverCitations.current;
    pendingTakeoverCitations.current = [];
    const userMessage: any = { role: "user", content: inputToSend };
    if (takeoverCits.length > 0) {
      userMessage.citations = takeoverCits;
    }
    setMessages(prev => [...prev, userMessage]);
    setUserInput("");
    setIsUserLoading(true);

    try {
      // Fire live judge in parallel with the AI stream (exchange 2+)
      // The judge evaluates the user's argument against the opponent's previous response,
      // so it can run while the AI is still generating its current response.
      const previousAiMessages = messages.filter(m => m.role === 'ai');
      const lastAiMessage = previousAiMessages[previousAiMessages.length - 1]?.content;
      if (previousAiMessages.length >= 1 && lastAiMessage) {
        fetchLiveJudgeFeedback(inputToSend, lastAiMessage);
      }

      const res = await fetch('/api/debate', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          debateId,
          character: debate?.character || debate?.opponent,
          opponentStyle: debate?.opponentStyle,
          topic: debate?.topic,
          userArgument: inputToSend,
          previousMessages: messages,
        }),
      });

      if (res.status === 429) {
        const data = await res.json();
        const current = data.details?.current ?? data.current;
        const limit = data.details?.limit ?? data.limit;
        setRateLimitData({ current, limit });
        if (data.details?.signup_required || data.isGuest) {
          setShowGuestLimitModal(true);
        } else {
          setShowUpgradeModal(true);
        }
        setMessages(prev => prev.slice(0, -1));
        return;
      }

      if (!res.ok) throw new Error('Failed to send message');

      // Stream the response
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      setIsUserLoading(false);
      setIsAILoading(true);

      let aiContent = "";
      let citations: any[] = [];
      const decoder = new TextDecoder();

      setMessages(prev => [...prev, { role: "ai", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'chunk' && data.content) {
                aiContent += data.content;
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = {
                    ...newMessages[newMessages.length - 1],
                    content: aiContent
                  };
                  return newMessages;
                });
              } else if (data.type === 'citations' && data.citations) {
                citations = data.citations;
              } else if (data.type === 'complete' && data.content) {
                // Use annotated content from server (includes [1], [2] markers)
                aiContent = data.content;
              }
            } catch {}
          }
        }
      }

      // Final update with citations
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          ...newMessages[newMessages.length - 1],
          content: aiContent,
          citations
        };
        return newMessages;
      });

    } catch (error) {
      console.error("Failed to send message:", error);
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          ...newMessages[newMessages.length - 1],
          failed: true
        };
        return newMessages;
      });
      showToast("Failed to send message. Please try again.");
    } finally {
      setIsUserLoading(false);
      setIsAILoading(false);
    }
  }, [userInput, isUserLoading, isAILoading, debateId, showToast]);

  // Store handleSend in ref for instant debate
  const handleSendRef = useRef(handleSend);
  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  // Handle AI takeover
  const handleAITakeover = useCallback(async () => {
    if (isAITakeoverLoading || isAILoading) return;
    setIsAITakeoverLoading(true);
    track('debate_message_sent' as any, { debate_id: debateId, aiAssisted: true });

    try {
      const res = await fetch('/api/debate/takeover', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ debateId, topic: debate?.topic, previousMessages: messages }),
      });

      if (res.status === 429) {
        const data = await res.json();
        const current = data.details?.current ?? data.current;
        const limit = data.details?.limit ?? data.limit;
        setRateLimitData({ current, limit });
        if (data.details?.signup_required || data.isGuest) {
          setShowGuestLimitModal(true);
        } else {
          setShowUpgradeModal(true);
        }
        return;
      }

      if (!res.ok) throw new Error('AI takeover failed');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No body');
      const decoder = new TextDecoder();
      let accumulated = '';
      let takeoverCitations: any[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        chunk.split('\n').forEach(line => {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'chunk') {
                accumulated += data.content;
                setUserInput(accumulated);
              } else if (data.type === 'citations' && data.citations) {
                takeoverCitations = data.citations;
              } else if (data.type === 'complete' && data.content) {
                // Use annotated content with inline [1], [2] markers
                accumulated = data.content;
                setUserInput(data.content);
              }
            } catch {}
          }
        });
      }
      // Store citations so handleSend attaches them to the AI-assisted message
      pendingTakeoverCitations.current = takeoverCitations;

    } catch (error) {
      console.error("AI takeover failed:", error);
      showToast("AI takeover failed. Please try again.");
      track('debate_ended' as any, { debate_id: debateId, reason: 'error' });
    } finally {
      setIsAITakeoverLoading(false);
      setIsAILoading(false);
    }
  }, [isAITakeoverLoading, isAILoading, debateId, showToast]);

  // Handle instant debate from homepage
  useEffect(() => {
    if (!isAuthLoaded || isLoadingDebate || instantDebateActiveRef.current) return;

    const isInstant = sessionStorage.getItem('isInstantDebate') === 'true';
    const firstArgument = sessionStorage.getItem('firstArgument');

    if (isInstant && firstArgument && debate) {
      sessionStorage.removeItem('isInstantDebate');
      sessionStorage.removeItem('firstArgument');
      instantDebateActiveRef.current = true;
      handleSendRef.current(firstArgument);
    }
  }, [isAuthLoaded, isLoadingDebate, debate]);

  // Coach panel resize handler
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startWidth = coachWidth;

    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      // Dragging left = wider coach, dragging right = narrower coach
      const delta = startX - e.clientX;
      const newWidth = Math.max(240, Math.min(600, startWidth + delta));
      setCoachWidth(newWidth);
    };

    const onMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // Persist to sessionStorage
      setCoachWidth(w => {
        sessionStorage.setItem('coachPanelWidth', String(w));
        return w;
      });
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [coachWidth]);

  const effectiveIsOwner = isOwner || isGuestOwner;
  const canSend = userInput.trim().length > 0 && !isUserLoading && !isAILoading && !isAITakeoverLoading && !isLiveJudgeLoading && !isJudging && effectiveIsOwner;
  const canRequestVerdict = effectiveIsOwner && messages.filter(m => m.role === 'user').length >= 2 && messages.filter(m => m.role === 'ai').length >= 2 && !isAILoading && !isUserLoading;

  if (loadError) {
    return (
      <div className="h-dvh flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">Failed to load debate</h2>
            <button onClick={() => window.location.reload()} className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white">Try Again</button>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthLoaded || isLoadingDebate) {
    return <><Header /><DebatePageSkeleton /></>;
  }

  return (
    <div className="h-dvh flex flex-col bg-[var(--bg)]">
      <Header />

      {/* Topic Header - Modern Pill Style */}
      {debate && (
        <div className="flex-shrink-0 border-b border-[var(--border)]/50 bg-[var(--bg)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">Topic</span>
                <h1 className="font-semibold text-[var(--text)]">{debate.topic}</h1>
              </div>
              <div className="hidden sm:block w-px h-4 bg-[var(--border)]" />
              <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <span>vs</span>
                <span className="font-medium text-[var(--text)]">{debate.opponentStyle || opponent?.name}</span>
              </div>
              {!effectiveIsOwner && debateAuthor && (
                <>
                  <div className="hidden sm:block w-px h-4 bg-[var(--border)]" />
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="text-[var(--text-tertiary)]">by</span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--bg-sunken)] border border-[var(--border)] text-[var(--text)]">
                      <svg className="w-3 h-3 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {debateAuthor.displayName}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Always split on desktop */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden justify-center">
        {/* Left: Chat Area */}
        <div className={`flex-1 flex flex-col min-h-0 border-l border-r border-[var(--border)]/50 ${effectiveIsOwner ? 'md:flex-[7] md:max-w-4xl' : 'md:max-w-5xl'}`}>
          {/* Chat messages — always visible */}
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden" onScroll={handleScroll}>
            <div className="pb-4">
              {(() => {
                let userMsgCount = 0;
                return messages.filter(m => m?.role).map((msg, idx) => {
                  const isUserMsg = msg.role === 'user';
                  if (isUserMsg) userMsgCount++;
                  // feedback[0] maps to user message #2, feedback[i] maps to user message #(i+2)
                  const exchangeIndex = isUserMsg ? userMsgCount - 2 : -1;
                  const hasFeedback = exchangeIndex >= 0 && exchangeIndex < liveFeedbackHistory.length;
                  const feedback = hasFeedback ? liveFeedbackHistory[exchangeIndex] : null;
                  const latestFeedback = liveFeedbackHistory.length > 0 ? liveFeedbackHistory[liveFeedbackHistory.length - 1] : null;
                  const msgHighlights = isUserMsg && latestFeedback
                    ? latestFeedback.highlights.filter(h => msg.content.includes(h.text))
                    : undefined;
                  const isExchangeHighlighted = highlightedExchange !== null && exchangeIndex === highlightedExchange;
                  return (
                    <div
                      key={idx}
                      onMouseEnter={hasFeedback ? () => setHighlightedExchange(exchangeIndex) : undefined}
                      onMouseLeave={hasFeedback ? () => setHighlightedExchange(null) : undefined}
                      className="relative"
                    >
                      <div className={`absolute -inset-x-3 -inset-y-1 rounded-xl bg-[var(--accent)]/5 border border-[var(--accent)]/10 pointer-events-none transition-opacity duration-200 ${isExchangeHighlighted ? 'opacity-100' : 'opacity-0'}`} />
                      <Message msg={msg} opponent={opponent} debate={debate}
                        isAILoading={!debateScore && isAILoading && idx === messages.length - 1}
                        isUserLoading={!debateScore && isUserLoading && idx === messages.length - 1}
                        onRetry={!debateScore && msg.failed ? () => {
                          setMessages(prev => prev.filter((_, i) => i !== idx));
                          setUserInput(msg.content);
                        } : undefined}
                        messageIndex={idx} isHighlighted={highlightedMessageIndex === idx} debateId={debateId} variant={variant}
                        highlights={msgHighlights} />
                    </div>
                  );
                });
              })()}

              {/* Post-debate actions (rematch, share, try next) */}
              {debateScore && (
                <div className="py-6 animate-message-in">
                  <PostDebateEngagement debateId={debateId} topic={debate?.topic || ""} opponentName={opponent?.name || debate?.opponentStyle || "AI"} variant={variant} />
                </div>
              )}

              <div ref={messagesEndRef} />

            </div>
          </div>

          {/* Footer: input or debate complete */}
          {debateScore ? (
            <div className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--bg)] px-4 py-3">
              <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/5 border border-[var(--accent)]/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                  </div>
                  <div className="text-sm text-[var(--text-secondary)]">Debate complete</div>
                </div>
                <a
                  href="/"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                  </svg>
                  New Debate
                </a>
              </div>
            </div>
          ) : !effectiveIsOwner ? (
            <div className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--bg-elevated)]/50">
              <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/5 border border-[var(--accent)]/10 flex items-center justify-center">
                      <svg className="w-5 h-5 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--text)]">
                        {debateAuthor ? `Viewing ${debateAuthor.displayName}'s debate` : 'Viewing debate'}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {!isAuthenticated 
                          ? 'Sign in to start your own debate' 
                          : 'You can watch but not participate'
                        }
                      </p>
                    </div>
                  </div>
                  
                  {!isAuthenticated && (
                    <a 
                      href="/sign-in" 
                      className="flex-shrink-0 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
                    >
                      Sign In
                    </a>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--bg)]">
              <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
                <div className="flex gap-3 items-end">
                  <div className="flex-1 relative">
                    <textarea
                      ref={textareaRef}
                      value={userInput}
                      onChange={(e) => { setUserInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 280) + "px"; }}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (canSend) handleSend(); } }}
                      placeholder={isAITakeoverLoading ? "" : "Make your argument..."}
                      className="w-full bg-[var(--bg-elevated)] border-2 border-[var(--border)] rounded-2xl px-5 py-4 resize-none text-[var(--text)] placeholder:text-[var(--text-secondary)]/50 outline-none focus:border-[var(--accent)]/50 focus:ring-4 focus:ring-[var(--accent)]/10 transition-all min-h-[100px] max-h-[280px] leading-relaxed text-base scrollbar-contained"
                      disabled={isUserLoading || isAILoading || isAITakeoverLoading || isJudging || !effectiveIsOwner}
                      rows={3}
                    />
                    {isAITakeoverLoading && !userInput && (
                      <div className="absolute top-4 left-5 flex items-center gap-2 pointer-events-none">
                        <span className="text-sm text-[var(--text-secondary)]/50">AI is writing</span>
                        <span className="inline-flex gap-0.5">
                          <span className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}/>
                          <span className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}/>
                          <span className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}/>
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pb-1">
                    <button
                      onClick={handleAITakeover}
                      disabled={isAITakeoverLoading || isAILoading || isLiveJudgeLoading || isJudging || !effectiveIsOwner}
                      title="Let AI argue for you"
                      className="w-12 h-12 rounded-xl border-2 border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5 transition-all disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      {isAITakeoverLoading ? (
                        <svg className="w-5 h-5 animate-spin text-[var(--accent)]" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => handleSend()}
                      disabled={!canSend}
                      className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${canSend ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] shadow-lg shadow-[var(--accent)]/25 hover:shadow-xl hover:shadow-[var(--accent)]/30 hover:-translate-y-0.5 active:translate-y-0' : 'bg-[var(--bg-sunken)] text-[var(--text-tertiary)] border-2 border-[var(--border)]'}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={handleResizeStart}
          className="hidden md:flex items-center justify-center w-1.5 cursor-col-resize hover:bg-[var(--accent)]/20 active:bg-[var(--accent)]/30 transition-colors group"
        >
          <div className="w-0.5 h-8 rounded-full bg-[var(--border)] group-hover:bg-[var(--accent)]/50 transition-colors" />
        </div>

        {/* Right: Live Judge Panel */}
        <div className="hidden md:flex flex-col min-h-0 border-r border-[var(--border)]/50" style={{ width: coachWidth, flexShrink: 0 }}>
          <LiveJudgePanel
              feedbackHistory={liveFeedbackHistory}
              isLoading={isLiveJudgeLoading}
              currentScore={liveFeedbackHistory.length > 0 ? liveFeedbackHistory[liveFeedbackHistory.length - 1].overallScore : null}
              isMobileDrawerOpen={showLiveJudgeDrawer}
              onMobileDrawerToggle={() => setShowLiveJudgeDrawer(!showLiveJudgeDrawer)}
              canRequestVerdict={canRequestVerdict && !debateScore}
              isJudging={isJudging}
              onRequestVerdict={requestJudgment}
              highlightedExchange={highlightedExchange}
              onHighlightExchange={setHighlightedExchange}
              debateScore={debateScore}
              opponentName={opponent?.name || debate?.opponentStyle || "AI"}
            />
        </div>

        {/* Mobile Live Judge */}
        <div className="md:hidden">
          <LiveJudgePanel
            feedbackHistory={liveFeedbackHistory}
            isLoading={isLiveJudgeLoading}
            currentScore={liveFeedbackHistory.length > 0 ? liveFeedbackHistory[liveFeedbackHistory.length - 1].overallScore : null}
            isMobileDrawerOpen={showLiveJudgeDrawer}
            onMobileDrawerToggle={() => setShowLiveJudgeDrawer(!showLiveJudgeDrawer)}
            canRequestVerdict={canRequestVerdict && !debateScore}
            isJudging={isJudging}
            onRequestVerdict={requestJudgment}
            highlightedExchange={highlightedExchange}
            onHighlightExchange={setHighlightedExchange}
            debateScore={debateScore}
            opponentName={opponent?.name || debate?.opponentStyle || "AI"}
          />
        </div>
      </div>

      {showUpgradeModal && <Suspense fallback={null}><UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} /></Suspense>}
      {showShareModal && <Suspense fallback={null}><ShareModal isOpen={showShareModal} onClose={() => setShowShareModal(false)} debateId={debateId} topic={debate?.topic || ''} /></Suspense>}
    </div>
  );
}
