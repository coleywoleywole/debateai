'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from './Toast';
import { track } from '@/lib/analytics';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  debateId: string;
  topic: string;
  opponentName?: string;
}

export default function ShareModal({ isOpen, onClose, debateId, topic, opponentName }: ShareModalProps) {
  const { showToast } = useToast();
  const [isCopying, setIsCopying] = useState(false);
  const [mounted, setMounted] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Store previously focused element and handle body scroll
  useEffect(() => {
    setMounted(true);
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Return focus to trigger when modal closes
  useEffect(() => {
    if (!isOpen && previousFocusRef.current) {
      previousFocusRef.current.focus();
    }
  }, [isOpen]);

  // Focus trap implementation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }

    if (e.key !== 'Tab') return;

    const modal = modalRef.current;
    if (!modal) return;

    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Focus close button when modal opens
      setTimeout(() => closeButtonRef.current?.focus(), 100);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!mounted || !isOpen) return null;

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://debateai.org';
  const debateUrl = `${baseUrl}/debate/${debateId}`;
  const shareText = `I just debated "${topic}" on DebateAI — can you do better?`;
  const shareTextWithOpponent = opponentName 
    ? `I just debated "${topic}" against ${opponentName} on DebateAI — can you do better?`
    : shareText;

  const shareOptions = [
    {
      name: 'X (Twitter)',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
      action: () => {
        track('debate_shared', { debateId, method: 'twitter', source: 'modal' });
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(debateUrl)}`;
        window.open(url, '_blank', 'width=550,height=420');
      },
      color: 'hover:bg-black hover:text-white',
    },
    {
      name: 'Reddit',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
        </svg>
      ),
      action: () => {
        track('debate_shared', { debateId, method: 'reddit', source: 'modal' });
        const url = `https://www.reddit.com/submit?title=${encodeURIComponent(shareText)}&url=${encodeURIComponent(debateUrl)}`;
        window.open(url, '_blank');
      },
      color: 'hover:bg-orange-600 hover:text-white',
    },
    {
      name: 'LinkedIn',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      ),
      action: () => {
        track('debate_shared', { debateId, method: 'linkedin', source: 'modal' });
        const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(debateUrl)}`;
        window.open(url, '_blank');
      },
      color: 'hover:bg-blue-600 hover:text-white',
    },
    {
      name: 'Facebook',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      ),
      action: () => {
        track('debate_shared', { debateId, method: 'facebook', source: 'modal' });
        const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(debateUrl)}`;
        window.open(url, '_blank', 'width=626,height=436');
      },
      color: 'hover:bg-blue-500 hover:text-white',
    },
  ];

  const handleCopyLink = async () => {
    if (isCopying) return;
    
    try {
      setIsCopying(true);
      await navigator.clipboard.writeText(debateUrl);
      track('debate_shared', { debateId, method: 'copy_link', source: 'modal' });
      showToast('Link copied to clipboard!', 'success');
    } catch (err) {
      console.error('Failed to copy:', err);
      showToast('Failed to copy link', 'error');
    } finally {
      setTimeout(() => setIsCopying(false), 500);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'DebateAI',
          text: shareTextWithOpponent,
          url: debateUrl,
        });
        track('debate_shared', { debateId, method: 'native_share', source: 'modal' });
        onClose();
      } catch (err) {
        console.log('Share cancelled');
      }
    }
  };

  const showNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <div className="fixed inset-0 z-50 animate-fade-in">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal */}
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div 
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-modal-title"
          className="w-full max-w-md bg-[var(--bg-elevated)] rounded-2xl shadow-2xl border border-[var(--border)] overflow-hidden animate-fade-scale"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-[var(--border)]">
            <div className="flex items-center justify-between">
              <div>
                <h2 id="share-modal-title" className="text-lg font-semibold text-[var(--text)]">Share this debate</h2>
                <p className="text-sm text-[var(--text-secondary)] mt-0.5" id="share-modal-desc">
                  Invite others to see your debate
                </p>
              </div>
              
              <button 
                ref={closeButtonRef}
                onClick={onClose}
                className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text)] hover:bg-[var(--bg-sunken)] hover:scale-110 transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
                aria-label="Close share dialog"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Preview Card */}
          <div className="px-6 py-4 bg-[var(--bg-sunken)]/50">
            <div className="p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)]/50">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-light)] flex items-center justify-center" aria-hidden="true">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[var(--text)] text-sm line-clamp-2">
                    {topic}
                  </p>
                  {opponentName && (
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      vs {opponentName}
                    </p>
                  )}
                  <p className="text-xs text-[var(--text-tertiary)] mt-2 truncate">
                    debateai.org
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Share Options */}
          <div className="px-6 py-4">
            <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-3">
              Share to
            </p>
            
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Share options">
              {shareOptions.map((option) => (
                <button
                  key={option.name}
                  onClick={option.action}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-xl 
                    bg-[var(--bg-sunken)] border border-[var(--border)]/30
                    text-[var(--text)] font-medium text-sm
                    hover:scale-[1.02] hover:shadow-md hover:border-[var(--border)]/50
                    active:scale-[0.98]
                    transition-all duration-150 ease-out
                    focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50
                    ${option.color}
                  `}
                >
                  {option.icon}
                  <span>{option.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Copy Link Section */}
          <div className="px-6 pb-6">
            <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-3">
              Or copy link
            </p>
            
            <div className="flex gap-2">
              <div 
                className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--bg-sunken)] border border-[var(--border)]/30 text-sm text-[var(--text-secondary)] truncate"
                aria-label="Debate URL"
              >
                {debateUrl}
              </div>
              
              <button
                onClick={handleCopyLink}
                disabled={isCopying}
                className={`
                  px-4 py-2.5 rounded-xl font-medium text-sm
                  bg-[var(--accent)] text-white 
                  hover:bg-[var(--accent-hover)] hover:scale-105 hover:shadow-lg hover:shadow-[var(--accent)]/20
                  active:scale-95
                  transition-all duration-150 ease-out
                  focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 focus:ring-offset-2 focus:ring-offset-[var(--bg-elevated)]
                  disabled:hover:scale-100 disabled:hover:shadow-none
                  ${isCopying ? 'scale-95' : ''}
                `}
                aria-label={isCopying ? 'Link copied' : 'Copy link to clipboard'}
                aria-live="polite"
              >
                {isCopying ? 'Copied!' : 'Copy'}
              </button>
            </div>
            
            {/* Native Share (Mobile) */}
            {showNativeShare && (
              <button
                onClick={handleNativeShare}
                className="
                  w-full mt-3 px-4 py-3 rounded-xl font-medium text-sm
                  bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20
                  hover:bg-[var(--accent)]/20 hover:scale-[1.02] hover:shadow-md hover:shadow-[var(--accent)]/10
                  active:scale-[0.98]
                  transition-all duration-150 ease-out
                  flex items-center justify-center gap-2
                  focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50
                "
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share via...
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
