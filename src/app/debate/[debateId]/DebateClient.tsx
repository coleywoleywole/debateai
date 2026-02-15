"use client";

import { useState, useEffect, useRef, memo, lazy, Suspense } from "react";
import React from "react";
import { useSafeUser } from "@/lib/useSafeClerk";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getOpponentById } from "@/lib/opponents";
import Header from "@/components/Header";
import Spinner from "@/components/Spinner";
import { track } from "@/lib/analytics";
import { useToast } from "@/components/Toast";
import ShareButtons from "@/components/ShareButtons";
import StickyShareButton from "@/components/StickyShareButton";
import JudgeMessage from "@/components/JudgeMessage";
import DebateVoting from "@/components/DebateVoting";
import PostDebateEngagement from "@/components/PostDebateEngagement";
import GuestModeWall from "@/components/GuestModeWall";
import { DebatePageSkeleton } from "@/components/Skeleton";
import type { DebateScore } from "@/lib/scoring";

// Lazy load modals - they're only shown on user interaction
const UpgradeModal = lazy(() => import("@/components/UpgradeModal"));
const ShareModal = lazy(() => import("@/components/ShareModal"));
const GuestLimitModal = lazy(() => import("@/components/GuestLimitModal"));

export interface DebateClientProps {
  initialDebate?: {
    id: string;
    topic: string;
    opponent?: string;
    character?: string;
    opponentStyle?: string;
    promptVariant?: 'default' | 'aggressive';
    messages?: Array<{ role: string; content: string; aiAssisted?: boolean; citations?: Array<{ id: number; url: string; title: string }> }>;
    score_data?: Record<string, unknown>;
    [key: string]: unknown;
  } | null;
  initialMessages?: Array<{ role: string; content: string; aiAssisted?: boolean; citations?: Array<{ id: number; url: string; title: string }> }>;
  initialIsOwner?: boolean;
}

// Streaming indicator
const StreamingIndicator = memo(() => (
  <div className="flex items-center gap-1.5 h-5">
    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '0ms' }} />
    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '100ms' }} />
    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '200ms' }} />
  </div>
));
StreamingIndicator.displayName = "StreamingIndicator";

// Search indicator
const SearchIndicator = memo(({ message }: { message: string }) => (
  <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
    <Spinner className="w-3.5 h-3.5" />
    <span>{message}</span>
  </div>
));
SearchIndicator.displayName = "SearchIndicator";

// Helper to render content with clickable citation links
const renderContentWithCitations = (
  content: string,
  citations: Array<{ id: number; url: string; title: string }> | undefined,
  onCitationClick: (id: number) => void
) => {
  if (!citations || citations.length === 0) {
    return content;
  }

  // Match citation markers like [1], [2], [3]
  const parts = content.split(/(\[\d+\])/g);

  return parts.map((part, index) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (match) {
      const citationId = parseInt(match[1], 10);
      const citation = citations.find(c => c.id === citationId);
      if (citation) {
        return (
          <button
            key={index}
            onClick={() => onCitationClick(citationId)}
            className="inline-flex items-baseline text-[11px] font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]
              hover:underline transition-colors cursor-pointer align-super leading-none mx-0.5"
            title={citation.title || citation.url}
          >
            [{citationId}]
          </button>
        );
      }
    }
    return part;
  });
};

// Message component
const Message = memo(
  ({
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
    onShare,
  }: {
    msg: {
      role: string;
      content: string;
      aiAssisted?: boolean;
      citations?: Array<{ id: number; url: string; title: string }>;
      isSearching?: boolean;
      failed?: boolean;
      failedReason?: 'rate_limit' | 'error';
    };
    opponent: any;
    debate: any;
    isAILoading: boolean;
    isUserLoading?: boolean;
    onRetry?: () => void;
    messageIndex: number;
    isHighlighted?: boolean;
    debateId?: string;
    variant?: 'default' | 'aggressive';
    onShare?: (msg: any, index: number) => void;
  }) => {
    const isUser = msg.role === "user";
    const isStreaming = (isUser && isUserLoading) || (!isUser && isAILoading);
    const isFailed = msg.failed;
    const hasContent = msg.content && msg.content.length > 0;
    const [showCitations, setShowCitations] = useState(false);
    const [highlightedCitation, setHighlightedCitation] = useState<number | null>(null);
    const [showShareToast, setShowShareToast] = useState(false);
    const citationRefs = useRef<{ [key: number]: HTMLAnchorElement | null }>({});
    const messageRef = useRef<HTMLDivElement>(null);

    // Handle highlight scroll effect
    useEffect(() => {
      if (isHighlighted && messageRef.current) {
        messageRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, [isHighlighted]);

    const handleShare = () => {
      if (onShare) {
        onShare(msg, messageIndex);
      } else if (debateId) {
        const url = `${window.location.origin}/debate/${debateId}?highlight_message_id=${messageIndex}`;
        navigator.clipboard.writeText(url).then(() => {
          setShowShareToast(true);
          setTimeout(() => setShowShareToast(false), 2000);
        }).catch(() => {});
      }
    };

    const handleCitationClick = (citationId: number) => {
      // Open citations panel if not already open
      if (!showCitations) {
        setShowCitations(true);
      }

      // Highlight the citation
      setHighlightedCitation(citationId);

      // Scroll to the citation after a brief delay for panel to open
      setTimeout(() => {
        const citationEl = citationRefs.current[citationId];
        if (citationEl) {
          citationEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);

      // Remove highlight after animation
      setTimeout(() => {
        setHighlightedCitation(null);
      }, 2000);
    };

    return (
      <div 
        ref={messageRef}
        id={`message-${messageIndex}`}
        className={`py-5 relative group ${isUser ? '' : (variant === 'aggressive' ? 'bg-red-900/5 border-y border-red-500/10' : 'bg-[var(--bg-elevated)]/60 border-y border-[var(--border)]/30')} ${isFailed ? 'opacity-80' : ''} ${isHighlighted ? 'animate-highlight-pulse' : ''}`}
      >
        {/* Highlight overlay */}
        {isHighlighted && (
          <div className="absolute inset-0 bg-[var(--accent)]/5 pointer-events-none" />
        )}
        
        {/* Share toast */}
        {showShareToast && (
          <div className="absolute top-2 right-4 z-10 px-3 py-1.5 rounded-full bg-[var(--accent)] text-white text-xs font-medium shadow-lg animate-fade-in">
            Link copied!
          </div>
        )}
        
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="flex gap-3">
            {/* Avatar */}
            <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm
              ${isFailed
                ? 'bg-[var(--error)]/10 text-[var(--error)] border border-[var(--error)]/30'
                : isUser
                  ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                  : variant === 'aggressive'
                    ? 'bg-red-500/10 text-red-500 border border-red-500/30 shadow-[0_0_8px_rgba(239,68,68,0.2)]'
                    : 'bg-[var(--bg-sunken)] border border-[var(--border)]/50'
              }`}
            >
              {isUser ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
              ) : (
                opponent?.avatar || "🤖"
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pt-0.5">
              {/* Name and Share */}
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-[var(--text)]">
                    {isUser ? "You" : (opponent?.name || debate?.opponentStyle || "AI Opponent")}
                  </span>
                  {msg.aiAssisted && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)] font-medium">
                      AI-assisted
                    </span>
                  )}
                </div>
                
                {/* Share button */}
                {hasContent && !isStreaming && debateId && (
                  <button
                    onClick={handleShare}
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-[var(--bg-sunken)] text-[var(--text-tertiary)] hover:text-[var(--accent)]"
                    title="Share this moment"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
                    </svg>
                  </button>
                )}
              </div>

              {/* Message Content */}
              <div className="text-[15px] leading-7 text-[var(--text)]">
                {!hasContent && isStreaming ? (
                  msg.isSearching ? (
                    <SearchIndicator message={msg.content || "Searching..."} />
                  ) : (
                    <StreamingIndicator />
                  )
                ) : (
                  <div className="whitespace-pre-wrap">
                    {renderContentWithCitations(msg.content, msg.citations, handleCitationClick)}
                    {isStreaming && (
                      <span className="inline-block w-2 h-4 ml-0.5 bg-[var(--accent)] animate-pulse rounded-sm" />
                    )}
                  </div>
                )}
              </div>

              {/* Failed State Indicator */}
              {isFailed && (
                <div className="mt-2 flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-1.5 text-[var(--error)]">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span>
                      {msg.failedReason === 'rate_limit'
                        ? 'Message limit reached'
                        : 'Failed to send'}
                    </span>
                  </div>
                  {onRetry && (
                    <button
                      onClick={onRetry}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium
                        bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                      </svg>
                      Retry
                    </button>
                  )}
                  {msg.failedReason === 'rate_limit' && (
                    <button
                      onClick={() => {
                        if (debateId) {
                          track('debate_friction_event', {
                            debateId,
                            type: 'upgrade_clicked_limit'
                          });
                        }
                        document.querySelector<HTMLButtonElement>('[data-upgrade-trigger]')?.click();
                      }}
                      className="text-xs text-[var(--accent)] hover:underline"
                    >
                      Upgrade for more
                    </button>
                  )}
                </div>
              )}

              {/* Citations */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-3">
                  <button
                    onClick={() => setShowCitations(!showCitations)}
                    className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                    </svg>
                    <span>Sources ({msg.citations.length})</span>
                    <svg
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${showCitations ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                    </svg>
                  </button>

                  <div className={`overflow-hidden transition-all duration-300 ${showCitations ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                    <div className="flex flex-wrap gap-2">
                      {msg.citations.map((citation) => (
                        <a
                          key={citation.id}
                          ref={(el) => { citationRefs.current[citation.id] = el; }}
                          href={citation.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--bg-sunken)]
                            text-xs text-[var(--text-secondary)] hover:text-[var(--accent)]
                            hover:bg-[var(--accent)]/5 transition-all duration-300 border border-[var(--border)]/30
                            ${highlightedCitation === citation.id
                              ? 'ring-2 ring-[var(--accent)] bg-[var(--accent)]/10 scale-105'
                              : ''}`}
                        >
                          <span className="font-medium text-[var(--accent)]">[{citation.id}]</span>
                          <span className="truncate max-w-[160px]">
                            {citation.title || new URL(citation.url).hostname}
                          </span>
                          <svg className="w-3 h-3 opacity-50 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                          </svg>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);
Message.displayName = "Message";

export default function DebateClient({ initialDebate = null, initialMessages = [], initialIsOwner = false }: DebateClientProps = {}) {
  const params = useParams();
  const searchParams = useSearchParams();
  const { user, isSignedIn } = useSafeUser();
  const { showToast } = useToast();
  const debateId = params.debateId as string;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [debate, setDebate] = useState<any>(initialDebate);
  const [messages, setMessages] = useState<any[]>(initialMessages);
  const [isOwner, setIsOwner] = useState<boolean>(initialIsOwner);
  const [userInput, setUserInput] = useState("");
  const instantDebateActiveRef = useRef(false);
  const [isLoadingDebate, setIsLoadingDebate] = useState(!initialDebate);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isAILoading, setIsAILoading] = useState(false);
  const [isUserLoading, setIsUserLoading] = useState(false);
  const [isAITakeoverLoading, setIsAITakeoverLoading] = useState(false);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [activeShareMessage, setActiveShareMessage] = useState<{message: any, index: number} | null>(null);
  const [rateLimitData, setRateLimitData] = useState<{ current: number; limit: number } | undefined>();
  const [debateScore, setDebateScore] = useState<DebateScore | null>(null);
  const [variant, setVariant] = useState<'default' | 'aggressive'>('default');
  const [guestTurnCount, setGuestTurnCount] = useState(0);
  const [showGuestLimitModal, setShowGuestLimitModal] = useState(false);
  const [isGuestOwner, setIsGuestOwner] = useState(false);
  const isDevMode = searchParams.get('dev') === 'true';

  // Set guest owner if this is a new debate and user is not signed in
  useEffect(() => {
    if (!isSignedIn && (isDevMode || (debateId && sessionStorage.getItem('guest_debate_id') === debateId))) {
      setIsGuestOwner(true);
    }
  }, [debateId, isSignedIn, isDevMode]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasUserInteracted = useRef(false);

  // Request judgment from the AI judge
  const requestJudgment = async () => {
    if (!debate || messages.length < 2) return;
    
    track('debate_judge_requested', {
      debateId,
      messageCount: messages.length,
    });

    try {
      const response = await fetch('/api/debate/judge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          debateId,
          topic: debate.topic,
          messages: messages.filter(m => m.role === 'user' || m.role === 'ai'),
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Judge API error:', errorText);
        track('debate_error', {
          debateId,
          source: 'requestJudgment',
          message: errorText,
          code: response.status.toString(),
        });
        return;
      }
      
      const data = await response.json();
      setDebateScore(data);

      // Track successful scoring (completion)
      track('debate_scored', {
        debateId,
        userScore: data.userScore,
        aiScore: data.aiScore,
        winner: data.winner,
      });

      track('debate_finished', {
        debateId,
        winner: data.winner,
        turnCount: messages.length,
      });

      track('debate_ended', {
        debateId,
        reason: 'completed',
        turnCount: messages.length,
      });
    } catch (error: any) {
      console.error('Failed to request judgment:', error);
      track('debate_error', {
        debateId,
        source: 'requestJudgment',
        message: error.message || 'Unknown error',
      });
    }
  };

  // Dev mode check moved up

  // Highlight message logic
  const highlightedMessageId = searchParams.get('highlight_message_id');
  const highlightedMessageIndex = highlightedMessageId ? parseInt(highlightedMessageId, 10) : null;

  // Load debate - skip fetch if server provided initial data
  // Revalidate on mount to fix back button cache issues
  useEffect(() => {
    // Always revalidate in the background to fix back button stale data
    const revalidateDebate = async () => {
      try {
        const response = await fetch(`/api/debate/${debateId}`);
        if (response.ok) {
          const data = await response.json();
          setDebate(data.debate);
          setIsOwner(data.isOwner);
          // Only update messages if not in the middle of instant debate
          if (!instantDebateActiveRef.current) {
            setMessages(data.debate.messages || []);
          }
          // Load existing score if debate was previously scored
          if (data.debate.score_data?.debateScore) {
            setDebateScore(data.debate.score_data.debateScore as DebateScore);
          }
          setLoadError(null);
        } else {
          track('debate_error', {
            debateId,
            source: 'revalidateDebate',
            message: `HTTP ${response.status}`,
            code: response.status.toString(),
          });
        }
      } catch (error: any) {
        console.error("Failed to revalidate debate:", error);
        track('debate_error', {
          debateId,
          source: 'revalidateDebate',
          message: error.message || 'Unknown error',
        });
        // Don't show error on revalidation - keep existing data
      } finally {
        setIsLoadingDebate(false);
      }
    };

    if (isDevMode) {
      setDebate({
        id: debateId,
        topic: "Should AI be regulated?",
        opponentStyle: "Elon Musk",
        character: "elon",
        messages: [
          { role: "user", content: "I think AI should be regulated to ensure safety and prevent misuse. We need guardrails in place before it's too late." },
          { role: "ai", content: "I disagree. Regulation stifles innovation. We need to move fast and break things. The market will self-regulate. Look at how the tech industry has evolved - innovation happens when smart people are free to experiment, not when bureaucrats write rules about technology they don't understand." },
          { role: "user", content: "But what about safety? We've seen AI systems produce harmful content and make biased decisions. Without regulation, companies will prioritize profit over public good." },
          { role: "ai", content: "Safety is important, but heavy-handed regulation kills innovation. Look at the EU's AI Act - it's already pushing AI development to other regions. The market naturally corrects for bad actors when consumers demand better." }
        ]
      });
      setMessages([
        { role: "user", content: "I think AI should be regulated to ensure safety and prevent misuse. We need guardrails in place before it's too late." },
        { role: "ai", content: "I disagree. Regulation stifles innovation. We need to move fast and break things. The market will self-regulate. Look at how the tech industry has evolved - innovation happens when smart people are free to experiment, not when bureaucrats write rules about technology they don't understand." },
        { role: "user", content: "But what about safety? We've seen AI systems produce harmful content and make biased decisions. Without regulation, companies will prioritize profit over public good." },
        { role: "ai", content: "Safety is important, but heavy-handed regulation kills innovation. Look at the EU's AI Act - it's already pushing AI development to other regions. The market naturally corrects for bad actors when consumers demand better." }
      ]);
      setIsLoadingDebate(false);
      return;
    }

    // Always revalidate to ensure fresh data (fixes back button issues)
    revalidateDebate();
  }, [debateId, isDevMode]);

  // Track debate view
  useEffect(() => {
    if (debateId) {
      track('debate_viewed', { debateId });
    }
  }, [debateId]);

  // Determine variant (A/B Test)
  useEffect(() => {
    if (debate?.promptVariant) {
      setVariant(debate.promptVariant as 'aggressive' | 'default');
    } else if (user?.id && !debate) {
      // Replicate backend A/B logic for immediate UI feedback on new debates
      const lastChar = user.id.slice(-1);
      if (lastChar.charCodeAt(0) % 2 === 0) {
        setVariant('aggressive');
      } else {
        setVariant('default');
      }
    } else if (isDevMode) {
       // Allow testing via URL param
       const variantParam = searchParams.get('variant');
       if (variantParam === 'aggressive') {
         setVariant('aggressive');
       }
    }
  }, [debate, user, isDevMode, searchParams]);

  // Handle instant debate from landing page
  useEffect(() => {
    const isInstant = sessionStorage.getItem('isInstantDebate') === 'true';
    const firstArgument = sessionStorage.getItem('firstArgument');

    if (isInstant && firstArgument && debate && !isLoadingDebate) {
      // Mark instant debate as active - prevents loadDebate from overwriting messages
      instantDebateActiveRef.current = true;
      hasUserInteracted.current = true;

      // Clear session storage
      sessionStorage.removeItem('isInstantDebate');
      sessionStorage.removeItem('firstArgument');

      // Auto-send the first message
      const sendFirstMessage = async () => {
        const userMessage = {
          role: "user",
          content: firstArgument,
          aiAssisted: false
        };

        // Add user message
        setMessages(prev => [...prev, userMessage]);
        setIsUserLoading(true);

        if (isDevMode) {
          // Simulate in dev mode
          setTimeout(() => {
            setIsUserLoading(false);
            setIsAILoading(true);

            setTimeout(() => {
              const aiMessage = {
                role: "ai",
                content: "That's an interesting point. However, I believe the free market will naturally find the right balance without government intervention. History has shown that excessive regulation often creates more problems than it solves."
              };
              setMessages(prev => [...prev, aiMessage]);
              setIsAILoading(false);
            }, 1500);
          }, 500);
        } else {
          // Real API call with streaming
          try {
            setIsUserLoading(false);
            setIsAILoading(true);

            // Add placeholder AI message for streaming
            setMessages(prev => [...prev, { role: 'ai', content: '' }]);

            const response = await fetch('/api/debate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                debateId,
                character: debate.opponent || debate.character || 'custom',
                opponentStyle: debate.opponentStyle,
                topic: debate.topic,
                userArgument: firstArgument,
                previousMessages: [],
                isAIAssisted: false
              })
            });

            if (!response.ok) {
              const error = await response.json();
              if (response.status === 429 && error.upgrade_required) {
                setRateLimitData({ current: error.current, limit: error.limit });
                setShowUpgradeModal(true);
                showToast("Message limit reached. Upgrade for unlimited debates!", "info", 5000);
                // Mark user message as failed, remove AI placeholder
                setMessages(prev => {
                  const newMsgs = [...prev];
                  // Remove AI placeholder (last message)
                  newMsgs.pop();
                  // Mark user message as failed (now last)
                  if (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].role === 'user') {
                    newMsgs[newMsgs.length - 1] = {
                      ...newMsgs[newMsgs.length - 1],
                      failed: true,
                      failedReason: 'rate_limit'
                    };
                  }
                  return newMsgs;
                });
                setIsAILoading(false);
                return; // Don't throw, we handled it gracefully
              }
              throw new Error(error.error || 'Failed to send message');
            }

            if (!response.body) throw new Error('No response body');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedContent = '';
            let citations: Array<{ id: number; url: string; title: string }> = [];

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value);
              const lines = chunk.split('\n');

              for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                  try {
                    const data = JSON.parse(line.substring(6));
                    if (data.type === 'chunk') {
                      accumulatedContent += data.content;
                      setMessages(prev => {
                        const newMessages = [...prev];
                        newMessages[newMessages.length - 1] = {
                          role: 'ai',
                          content: accumulatedContent,
                          citations: citations.length > 0 ? citations : undefined
                        };
                        return newMessages;
                      });
                    } else if (data.type === 'citations' && data.citations) {
                      citations = data.citations;
                    } else if (data.type === 'search_start') {
                      setMessages(prev => {
                        const newMessages = [...prev];
                        newMessages[newMessages.length - 1] = {
                          role: 'ai',
                          content: '',
                          isSearching: true
                        };
                        return newMessages;
                      });
                    } else if (data.type === 'complete') {
                      setMessages(prev => {
                        const newMessages = [...prev];
                        newMessages[newMessages.length - 1] = {
                          role: 'ai',
                          content: data.content,
                          citations: data.citations || (citations.length > 0 ? citations : undefined)
                        };
                        return newMessages;
                      });
                    }
                  } catch { /* skip invalid JSON */ }
                }
              }
            }
          } catch (error) {
            console.error("Failed to send first message:", error);
            showToast("Failed to start debate. Please try again.", "error");
            // Remove placeholder if there was an error
            setMessages(prev => {
              const lastMsg = prev[prev.length - 1];
              if (lastMsg && lastMsg.role === 'ai' && !lastMsg.content) {
                return prev.slice(0, -1);
              }
              return prev;
            });
          } finally {
            setIsAILoading(false);
          }
        }
      };

      sendFirstMessage();
    }
  }, [debate, isLoadingDebate, debateId, isDevMode, showToast]);

  // Auto-scroll - skip on initial SSR render so the page doesn't load scrolled past the top.
  // Only scroll after the user starts interacting (sending messages).
  useEffect(() => {
    if (!hasUserInteracted.current) return;
    if (isAutoScrollEnabled && messagesEndRef.current) {
      // Use 'instant' scroll during AI streaming to prevent layout bouncing
      const behavior = isAILoading ? 'instant' : 'smooth';
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  }, [messages, isAutoScrollEnabled, isAILoading]);

  const opponent = debate ? getOpponentById(debate.opponent || debate.character) : null;

  // Handle scroll - throttled to reduce state updates
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleScroll = () => {
    if (scrollTimeoutRef.current) return;

    scrollTimeoutRef.current = setTimeout(() => {
      scrollTimeoutRef.current = null;
      if (scrollContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        setIsAutoScrollEnabled(isNearBottom);
      }
    }, 100);
  };

  // Send message handler
  const handleSend = async () => {
    if (userInput.trim() && (isUserLoading || isAILoading)) {
      track('debate_friction_event', {
        debateId,
        type: 'send_while_loading'
      });
      return;
    }

    if (!isSignedIn) {
      // Guest limit removed to improve completion rate
      // if (guestTurnCount >= 15) {
      //   setShowGuestLimitModal(true);
      //   track('guest_limit_reached', { debateId, turnCount: guestTurnCount });
      //   return;
      // }
      setGuestTurnCount(prev => prev + 1);
    }

    if (!userInput.trim() || isUserLoading || isAILoading) return;

    const startTime = Date.now();
    const messageText = userInput.trim();
    hasUserInteracted.current = true;

    if (messages.length === 0) {
      track('debate_started', { debateId, topic: debate?.topic, source: 'manual' });
    }

    // Add user message immediately
    const userMessage = {
      role: "user",
      content: messageText,
      aiAssisted: false
    };

    setMessages(prev => [...prev, userMessage]);
    setUserInput("");
    setIsUserLoading(true);
    setIsAutoScrollEnabled(true);

    // Track message sent
    track('debate_message_sent', {
      debateId,
      messageIndex: messages.length,
      turnCount: messages.length + 1,
      aiAssisted: false,
    });

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    if (isDevMode) {
      // Simulate API delay
      setTimeout(() => {
        setIsUserLoading(false);
        setIsAILoading(true);

        // Simulate AI response after a delay
        setTimeout(() => {
          const aiMessage = {
            role: "ai",
            content: "That's an interesting point. However, I believe the free market will naturally find the right balance without government intervention. History has shown that excessive regulation often creates more problems than it solves."
          };
          setMessages(prev => [...prev, aiMessage]);
          setIsAILoading(false);
        }, 1500);
      }, 500);
    } else {
      // Real API call with streaming
      try {
        setIsUserLoading(false);
        setIsAILoading(true);

        // Add placeholder AI message for streaming
        setMessages(prev => [...prev, { role: 'ai', content: '' }]);

        const response = await fetch('/api/debate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            debateId,
            character: debate?.opponent || debate?.character || 'custom',
            opponentStyle: debate?.opponentStyle,
            topic: debate?.topic,
            userArgument: messageText,
            previousMessages: messages,
            isAIAssisted: false
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          if (response.status === 429 && error.upgrade_required) {
            setRateLimitData({ current: error.current, limit: error.limit });
            setShowUpgradeModal(true);
            showToast("Message limit reached. Upgrade for unlimited debates!", "info", 5000);
            // Mark user message as failed with inline retry option
            setMessages(prev => {
              const newMsgs = [...prev];
              // Remove AI placeholder (last message)
              if (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].role === 'ai') {
                newMsgs.pop();
              }
              // Mark user message as failed (now last)
              if (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].role === 'user') {
                newMsgs[newMsgs.length - 1] = {
                  ...newMsgs[newMsgs.length - 1],
                  failed: true,
                  failedReason: 'rate_limit'
                };
              }
              return newMsgs;
            });
            setIsAILoading(false);
            return; // Don't throw, we handled it gracefully
          }
          throw new Error(error.error || 'Failed to send message');
        }

        if (!response.body) throw new Error('No response body');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = '';
        let citations: Array<{ id: number; url: string; title: string }> = [];
        let hasReceivedFirstToken = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const data = JSON.parse(line.substring(6));
                if (data.type === 'chunk') {
                  if (!hasReceivedFirstToken) {
                    hasReceivedFirstToken = true;
                    track('debate_ai_ttft', {
                      debateId,
                      messageIndex: messages.length + 1,
                      latencyMs: Date.now() - startTime
                    });
                  }
                  accumulatedContent += data.content;
                  setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1] = {
                      role: 'ai',
                      content: accumulatedContent,
                      citations: citations.length > 0 ? citations : undefined
                    };
                    return newMessages;
                  });
                } else if (data.type === 'citations' && data.citations) {
                  citations = data.citations;
                } else if (data.type === 'search_start') {
                  setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1] = {
                      role: 'ai',
                      content: '',
                      isSearching: true
                    };
                    return newMessages;
                  });
                } else if (data.type === 'complete') {
                  const latencyMs = Date.now() - startTime;
                  track('debate_ai_response_latency', {
                    debateId,
                    messageIndex: messages.length + 1,
                    latencyMs,
                  });
                  track('debate_ai_message_sent', {
                    debateId,
                    messageIndex: messages.length + 2,
                    turnCount: messages.length + 2
                  });
                  setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1] = {
                      role: 'ai',
                      content: data.content,
                      citations: data.citations || (citations.length > 0 ? citations : undefined)
                    };
                    return newMessages;
                  });
                }
              } catch { /* skip invalid JSON */ }
            }
          }
        }
      } catch (error: any) {
        console.error("Failed to send message:", error);
        track('debate_error', {
          debateId,
          source: 'handleSend',
          message: error.message || 'Unknown error',
        });
        showToast("Failed to send message. Please try again.", "error");
        // Remove placeholder if there was an error and it's empty
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.role === 'ai' && !lastMsg.content) {
            return prev.slice(0, -1);
          }
          return prev;
        });
      } finally {
        setIsAILoading(false);
      }
    }
  };

  // AI Takeover - generates an AI argument for the user
  const handleAITakeover = async () => {
    if (isAITakeoverLoading || isAILoading) {
      track('debate_friction_event', {
        debateId,
        type: 'send_while_loading'
      });
      return;
    }
    
    const startTime = Date.now();
    hasUserInteracted.current = true;
    setIsAITakeoverLoading(true);
    setIsAutoScrollEnabled(true);

    if (messages.length === 0) {
      track('debate_started', { debateId, topic: debate?.topic, source: 'ai_takeover' });
    }

    // Track AI takeover used
    track('debate_ai_takeover', {
      debateId,
      messageIndex: messages.length,
    });

    try {
      // Add placeholder user message for streaming
      setMessages(prev => [...prev, { 
        role: 'user', 
        content: '', 
        aiAssisted: true,
        isSearching: true 
      }]);

      const response = await fetch('/api/debate/takeover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          debateId,
          topic: debate?.topic,
          opponentStyle: debate?.opponentStyle,
          previousMessages: messages,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 429 && error.upgrade_required) {
          setRateLimitData({ current: error.current, limit: error.limit });
          setShowUpgradeModal(true);
          showToast("AI takeover limit reached. Upgrade for unlimited access!", "info", 5000);
          // Remove placeholder
          setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.role === 'user' && lastMsg.aiAssisted) {
              return prev.slice(0, -1);
            }
            return prev;
          });
          setIsAITakeoverLoading(false);
          return;
        }
        throw new Error(error.error || 'Failed to generate AI argument');
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';
      let citations: Array<{ id: number; url: string; title: string }> = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.substring(6));
              if (data.type === 'chunk') {
                accumulatedContent += data.content;
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = {
                    role: 'user',
                    content: accumulatedContent,
                    aiAssisted: true,
                    citations: citations.length > 0 ? citations : undefined
                  };
                  return newMessages;
                });
              } else if (data.type === 'citations' && data.citations) {
                citations = data.citations;
              } else if (data.type === 'search_start') {
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = {
                    role: 'user',
                    content: accumulatedContent || '',
                    aiAssisted: true,
                    isSearching: true
                  };
                  return newMessages;
                });
              } else if (data.type === 'error') {
                throw new Error(data.error || 'AI takeover failed');
              }
            } catch (parseError) {
              // Re-throw intentional errors (from data.type === 'error' branch)
              // Only swallow JSON SyntaxErrors
              if (parseError instanceof SyntaxError) {
                /* skip invalid JSON */
              } else {
                throw parseError;
              }
            }
          }
        }
      }

      // Guard: if takeover produced no content, don't call opponent API
      if (!accumulatedContent || accumulatedContent.trim() === '') {
        throw new Error('AI takeover produced no content');
      }

      // Now trigger the AI opponent response
      setIsAITakeoverLoading(false);
      setIsAILoading(true);

      // Add placeholder AI message for streaming
      setMessages(prev => [...prev, { role: 'ai', content: '' }]);

      const debateResponse = await fetch('/api/debate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          debateId,
          character: debate?.opponent || debate?.character || 'custom',
          opponentStyle: debate?.opponentStyle,
          topic: debate?.topic,
          userArgument: accumulatedContent,
          previousMessages: [...messages, { role: 'user', content: accumulatedContent }],
          isAIAssisted: true
        }),
      });

      if (!debateResponse.ok) {
        const error = await debateResponse.json();
        throw new Error(error.error || 'Failed to get opponent response');
      }

      if (!debateResponse.body) throw new Error('No response body');

      const debateReader = debateResponse.body.getReader();
      const debateDecoder = new TextDecoder();
      let debateAccumulatedContent = '';
      let debateCitations: Array<{ id: number; url: string; title: string }> = [];
      let hasReceivedFirstToken = false;

      while (true) {
        const { done, value } = await debateReader.read();
        if (done) break;

        const chunk = debateDecoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.substring(6));
              if (data.type === 'chunk') {
                if (!hasReceivedFirstToken) {
                  hasReceivedFirstToken = true;
                  track('debate_ai_ttft', {
                    debateId,
                    messageIndex: messages.length + 1,
                    latencyMs: Date.now() - startTime
                  });
                }
                debateAccumulatedContent += data.content;
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = {
                    role: 'ai',
                    content: debateAccumulatedContent,
                    citations: debateCitations.length > 0 ? debateCitations : undefined
                  };
                  return newMessages;
                });
              } else if (data.type === 'citations' && data.citations) {
                debateCitations = data.citations;
              } else if (data.type === 'complete') {
                const latencyMs = Date.now() - startTime;
                track('debate_ai_response_latency', {
                  debateId,
                  messageIndex: messages.length + 1,
                  latencyMs,
                });
                track('debate_ai_message_sent', {
                  debateId,
                  messageIndex: messages.length + 2,
                  turnCount: messages.length + 2
                });
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = {
                    role: 'ai',
                    content: data.content || debateAccumulatedContent,
                    citations: data.citations || (debateCitations.length > 0 ? debateCitations : undefined)
                  };
                  return newMessages;
                });
              }
            } catch { /* skip invalid JSON */ }
          }
        }
      }

    } catch (error: any) {
      console.error("AI takeover failed:", error);
      track('debate_error', {
        debateId,
        source: 'handleAITakeover',
        message: error.message || 'Unknown error',
      });
      showToast("Failed to generate AI argument. Please try again.", "error");
      // Remove any empty placeholder messages (both AI opponent and AI-assisted user)
      setMessages(prev => {
        let cleaned = [...prev];
        // Remove empty AI opponent placeholder if it exists
        const lastMsg = cleaned[cleaned.length - 1];
        if (lastMsg && lastMsg.role === 'ai' && !lastMsg.content) {
          cleaned = cleaned.slice(0, -1);
        }
        // Remove empty AI-assisted user placeholder if it exists
        const lastUserMsg = cleaned[cleaned.length - 1];
        if (lastUserMsg && lastUserMsg.role === 'user' && lastUserMsg.aiAssisted && !lastUserMsg.content) {
          cleaned = cleaned.slice(0, -1);
        }
        return cleaned;
      });
    } finally {
      setIsAITakeoverLoading(false);
      setIsAILoading(false);
    }
  };

  // Error state - show error with retry
  if (loadError) {
    return (
      <div className="h-dvh flex flex-col overflow-hidden">
        <Header />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--error)]/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--error)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-[var(--text)] mb-2">Failed to load debate</h2>
            <p className="text-[var(--text-secondary)] mb-6">{loadError}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  setLoadError(null);
                  setIsLoadingDebate(true);
                  // Re-trigger the useEffect by changing a dependency
                  window.location.reload();
                }}
                className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent-hover)] transition-colors"
              >
                Try Again
              </button>
              <a
                href="/history"
                className="px-5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text)] font-medium hover:bg-[var(--bg-sunken)] transition-colors"
              >
                Back to History
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading state - skeleton loader
  if (!isDevMode && (isSignedIn === undefined || isLoadingDebate)) {
    return (
      <>
        <Header />
        <DebatePageSkeleton />
      </>
    );
  }

  const effectiveIsOwner = isOwner || isGuestOwner;
  const canSend = userInput.trim().length > 0 && !isUserLoading && !isAILoading && effectiveIsOwner;

  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-[var(--bg)] transition-colors duration-500">
      <Header />

      {/* Topic Header - Fixed */}
      {debate && (
        <div className="flex-shrink-0 z-10 border-b border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--bg)]/80">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 text-sm flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)] flex-shrink-0">Topic</span>
                  {variant === 'aggressive' && (
                    <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 text-[10px] font-bold border border-red-500/20 uppercase tracking-wider">
                      Hard Mode
                    </span>
                  )}
                  <h1 className="font-medium text-[var(--text)] truncate hidden sm:block">{debate.topic}</h1>
                </div>

                <h1 className="font-medium text-[var(--text)] truncate sm:hidden">{debate.topic}</h1>

                {(debate.opponentStyle || opponent) && (
                  <div className="flex items-center gap-1 min-w-0 sm:ml-0">
                    <span className="text-[var(--border-strong)] flex-shrink-0 hidden sm:inline mr-1">·</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] sm:hidden flex-shrink-0">vs</span>
                    <span className="text-[var(--text-secondary)] truncate">{debate.opponentStyle || opponent?.name}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <ShareButtons debateId={debateId} topic={debate.topic} onOpenModal={() => setShowShareModal(true)} />
                <Link
                  href="/"
                  onClick={() => track('debate_ended', { debateId, reason: 'abandoned', turnCount: messages.length })}
                  className="p-2 rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--bg-sunken)] hover:text-[var(--text)] transition-colors"
                  title="End Debate"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages - Scrollable */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto min-h-0 max-h-[calc(100dvh-180px)] sm:max-h-none"
        onScroll={handleScroll}
      >
        <div className="pb-4">
          {messages.filter((msg) => msg && msg.role).map((msg, idx) => (
            <Message
              key={idx}
              msg={msg}
              opponent={opponent}
              debate={debate}
              variant={variant}
              isAILoading={isAILoading && idx === messages.length - 1}
              isUserLoading={isUserLoading && idx === messages.length - 1}
              onRetry={msg.failed ? () => {
                track('debate_friction_event', {
                  debateId,
                  type: 'retry_clicked'
                });
                // Remove the failed message and restore input for retry
                setMessages(prev => prev.filter((_, i) => i !== idx));
                setUserInput(msg.content);
              } : undefined}
              messageIndex={idx}
              isHighlighted={highlightedMessageIndex === idx}
              debateId={debateId}
              onShare={(msg, index) => setActiveShareMessage({ message: msg, index })}
            />
          ))}

          {/* Score Card - show inline judge message when score exists */}
          {debateScore && (
            <JudgeMessage
              score={debateScore}
              opponentName={opponent?.name || debate?.opponentStyle || "AI"}
            />
          )}

          {/* Community Voting */}
          {debateScore && (
            <DebateVoting
              debateId={debateId}
              userSideName="You"
              opponentSideName={opponent?.name || debate?.opponentStyle || "AI"}
            />
          )}

          {/* Post-debate engagement — shown after scoring */}
          {debateScore && (
            <PostDebateEngagement
              debateId={debateId}
              topic={debate?.topic || ""}
              opponentName={opponent?.name || debate?.opponentStyle || "AI"}
              opponentId={opponent?.id}
            />
          )}

          <div ref={messagesEndRef} />
          
          {/* Guest Mode Wall - shown after 2 messages for non-signed-in users */}
          {!isSignedIn && messages.filter(m => m.role === 'user').length >= 2 && (
            <GuestModeWall 
              isOpen={true} 
              messageCount={messages.filter(m => m.role === 'user').length}
              onClose={() => {
                // Allow 1 more message then show again
                track('guest_mode_wall_dismissed', { 
                  messageCount: messages.filter(m => m.role === 'user').length 
                });
              }}
            />
          )}
          
          {/* Request Judgment Button - shown when enough messages but no score */}
          {!debateScore && messages.filter(m => m.role === 'user' || m.role === 'ai').length >= 2 && (
            <div className="flex justify-center my-4 animate-fade-in">
              <button
                onClick={requestJudgment}
                disabled={isAILoading || isUserLoading}
                className="group flex items-center gap-2 px-3 py-1.5 rounded-lg
                  text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-sunken)]
                  transition-all disabled:opacity-50"
              >
                <span className="opacity-70 group-hover:scale-110 transition-transform">⚖️</span>
                <span>Ready for the verdict?</span>
                <span className="text-[var(--accent)] font-medium group-hover:underline ml-0.5">Ask Judge</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Input Area - Fixed at bottom with mobile keyboard handling */}
      <div className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--bg)] z-50 relative">
        <div className="max-w-3xl mx-auto px-3 sm:px-6 py-2 sm:py-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {/* Input Row */}
          <div className="flex gap-2">
            {/* Textarea Container */}
            <div className="flex-1 min-w-0 relative">
              {!effectiveIsOwner && (
                <div className="absolute inset-0 bg-[var(--bg)]/80 backdrop-blur-sm rounded-xl flex items-center justify-center z-10">
                  <span className="text-sm text-[var(--text-secondary)] flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                    </svg>
                    View only — sign in to start your own debate
                  </span>
                </div>
              )}
              <textarea
                ref={textareaRef}
                value={userInput}
                onChange={(e) => {
                  setUserInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (canSend) handleSend();
                  }
                }}
                onFocus={() => {
                  document.body.classList.add('input-focused');
                  // Scroll to bottom on mobile when focusing input
                  setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                }}
                onBlur={() => {
                  document.body.classList.remove('input-focused');
                }}
                placeholder={effectiveIsOwner ? "Make your argument..." : "Sign in to contribute..."}
                className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl
                  px-3 sm:px-4 py-2.5 sm:py-3 resize-none text-[var(--text)] placeholder-[var(--text-tertiary)]
                  outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20
                  transition-all min-h-[44px] sm:min-h-[48px] max-h-[120px] text-base sm:text-[15px] leading-relaxed overflow-hidden
                  touch-manipulation disabled:opacity-50"
                rows={1}
                disabled={isUserLoading || isAILoading || !effectiveIsOwner}
              />
            </div>

            {/* Buttons - Fixed size, centered vertically */}
            <div className="flex items-center gap-1.5 flex-shrink-0 self-center">
              {/* AI Takeover Button */}
              <button
                type="button"
                onClick={handleAITakeover}
                disabled={isAITakeoverLoading || isAILoading || !effectiveIsOwner}
                className={`
                  w-10 h-10 rounded-lg border flex items-center justify-center
                  transition-all duration-200 flex-shrink-0
                  ${isAITakeoverLoading
                    ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10'
                    : 'border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/30'
                  }
                  disabled:opacity-40 disabled:cursor-not-allowed
                `}
                title={effectiveIsOwner ? "Let AI argue for you" : "Sign in to contribute to this debate"}
              >
                {isAITakeoverLoading ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                  </svg>
                )}
              </button>

              {/* Send Button */}
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className={`
                  w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                  transition-all duration-200
                  ${canSend
                    ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] cursor-pointer'
                    : 'bg-[var(--bg-sunken)] text-[var(--text-tertiary)] cursor-not-allowed'
                  }
                `}
                title="Send message"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Keyboard Hints - hidden on mobile */}
          <div className="hidden sm:flex mt-2 items-center justify-center gap-4 text-[11px] text-[var(--text-tertiary)]">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-sunken)] border border-[var(--border)] text-[var(--text-secondary)] font-mono text-[10px]">Enter</kbd>
              to send
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-sunken)] border border-[var(--border)] text-[var(--text-secondary)] font-mono text-[10px]">Shift + Enter</kbd>
              for new line
            </span>
          </div>
        </div>
      </div>

      {/* Sticky Share CTA - Show when there are messages but debate not finished */}
      {!debateScore && messages.length >= 2 && (
        <div className="absolute bottom-24 right-4 sm:bottom-8 sm:right-8 z-30 animate-fade-in">
          <StickyShareButton onClick={() => {
            track('share_button_clicked', { debateId, location: 'sticky' });
            setShowShareModal(true);
          }} />
        </div>
      )}

      {/* Lazy-loaded modals - only loaded when shown */}
      {showUpgradeModal && (
        <Suspense fallback={null}>
          <UpgradeModal
            isOpen={showUpgradeModal}
            onClose={() => setShowUpgradeModal(false)}
            trigger="rate-limit-message"
            limitData={rateLimitData}
          />
        </Suspense>
      )}

      {showGuestLimitModal && (
        <Suspense fallback={null}>
          <GuestLimitModal
            isOpen={showGuestLimitModal}
            onClose={() => setShowGuestLimitModal(false)}
            turnCount={guestTurnCount}
          />
        </Suspense>
      )}

      {(showShareModal || activeShareMessage) && (
        <Suspense fallback={null}>
          <ShareModal
            isOpen={showShareModal || !!activeShareMessage}
            onClose={() => {
              setShowShareModal(false);
              setActiveShareMessage(null);
            }}
            debateId={debateId}
            topic={debate?.topic || ''}
            opponentName={opponent?.name || debate?.opponentStyle}
            message={activeShareMessage?.message}
            messageIndex={activeShareMessage?.index}
          />
        </Suspense>
      )}
    </div>
  );
}
