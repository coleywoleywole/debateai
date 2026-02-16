'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { toPng } from 'html-to-image';
import { useToast } from './Toast';
import { track } from '@/lib/analytics';
import ShareImageCard from './ShareImageCard';

interface ShareImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  debateId: string;
  topic: string;
  opponentName: string;
  messages: Array<{ role: string; content: string }>;
  score?: {
    winner: 'user' | 'ai' | 'draw';
    userScore: number;
    aiScore: number;
  } | null;
}

export default function ShareImageModal({
  isOpen,
  onClose,
  debateId,
  topic,
  opponentName,
  messages,
  score,
}: ShareImageModalProps) {
  const { showToast } = useToast();
  const cardRef = useRef<HTMLDivElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [mounted, setMounted] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Get final arguments
  const userMessages = messages.filter((m) => m.role === 'user');
  const aiMessages = messages.filter((m) => m.role === 'ai');
  const userArgument = userMessages[userMessages.length - 1]?.content || '';
  const aiArgument = aiMessages[aiMessages.length - 1]?.content || '';

  // Store previously focused element and handle body scroll
  useEffect(() => {
    setMounted(true);
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
      // Generate image when modal opens
      generateImage();
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
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
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
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Focus close button when modal opens
      setTimeout(() => closeButtonRef.current?.focus(), 100);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  const generateImage = async () => {
    if (!cardRef.current || isGenerating) return;

    setIsGenerating(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 0.95,
        pixelRatio: 2,
      });
      setImageUrl(dataUrl);
      track('share_image_generated', { debateId });
    } catch (error) {
      console.error('Failed to generate image:', error);
      showToast('Failed to generate image', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!imageUrl) return;

    const link = document.createElement('a');
    link.download = `debate-${debateId}.png`;
    link.href = imageUrl;
    link.click();
    track('share_image_downloaded', { debateId });
    showToast('Image downloaded!', 'success');
  };

  const handleShareX = () => {
    if (!imageUrl) return;

    const shareText = `I just debated "${topic}" on DebateAI — can you do better?`;
    const debateUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://debateai.org'}/debate/${debateId}`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(debateUrl)}`;
    window.open(twitterUrl, '_blank', 'width=550,height=420');
    track('share_image_shared', { debateId, method: 'twitter' });
  };

  const handleCopyLink = async () => {
    const debateUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://debateai.org'}/debate/${debateId}`;
    try {
      await navigator.clipboard.writeText(debateUrl);
      track('share_image_copied', { debateId });
      showToast('Link copied to clipboard!', 'success');
    } catch {
      showToast('Failed to copy link', 'error');
    }
  };

  if (!mounted || !isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 animate-fade-in">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-image-modal-title"
          className="w-full max-w-2xl bg-[var(--bg-elevated)] rounded-2xl shadow-2xl border border-[var(--border)] overflow-hidden animate-fade-scale max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-[var(--border)] sticky top-0 bg-[var(--bg-elevated)] z-10">
            <div className="flex items-center justify-between">
              <div>
                <h2 id="share-image-modal-title" className="text-lg font-semibold text-[var(--text)]">
                  Share your debate
                </h2>
                <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                  Download or share this image
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

          {/* Image Preview */}
          <div className="p-6 bg-[var(--bg-sunken)]/50">
            {isGenerating ? (
              <div className="aspect-[4/3] bg-[var(--bg)] rounded-xl flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <svg className="w-8 h-8 text-[var(--accent)] animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-sm text-[var(--text-secondary)]">Generating image...</span>
                </div>
              </div>
            ) : imageUrl ? (
              <div className="rounded-xl overflow-hidden shadow-lg">
                <img
                  src={imageUrl}
                  alt="Debate share card"
                  className="w-full h-auto"
                />
              </div>
            ) : (
              <div className="aspect-[4/3] bg-[var(--bg)] rounded-xl flex items-center justify-center">
                <span className="text-sm text-[var(--text-secondary)]">Failed to generate image</span>
              </div>
            )}

            {/* Hidden card for generation */}
            <div className="absolute -left-[9999px] -top-[9999px]">
              <ShareImageCard
                ref={cardRef}
                topic={topic}
                userArgument={userArgument}
                aiArgument={aiArgument}
                opponentName={opponentName}
                winner={score?.winner}
                userScore={score?.userScore}
                aiScore={score?.aiScore}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="px-6 pb-6">
            <div className="grid grid-cols-2 gap-3">
              {/* Download Button */}
              <button
                onClick={handleDownload}
                disabled={!imageUrl || isGenerating}
                className="
                  flex items-center justify-center gap-2 px-4 py-3 rounded-xl 
                  bg-[var(--accent)] text-white font-medium text-sm
                  hover:bg-[var(--accent-hover)] hover:scale-[1.02] hover:shadow-lg hover:shadow-[var(--accent)]/20
                  active:scale-[0.98]
                  transition-all duration-150 ease-out
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                  focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50
                "
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Image
              </button>

              {/* Share on X */}
              <button
                onClick={handleShareX}
                disabled={!imageUrl || isGenerating}
                className="
                  flex items-center justify-center gap-2 px-4 py-3 rounded-xl 
                  bg-[var(--bg-sunken)] border border-[var(--border)]/30
                  text-[var(--text)] font-medium text-sm
                  hover:bg-[var(--bg)] hover:border-[var(--border)]/60 hover:scale-[1.02]
                  active:scale-[0.98]
                  transition-all duration-150 ease-out
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                  focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50
                "
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                Share on X
              </button>
            </div>

            {/* Copy Link */}
            <button
              onClick={handleCopyLink}
              className="
                w-full mt-3 px-4 py-3 rounded-xl 
                bg-[var(--bg-sunken)] border border-[var(--border)]/30
                text-[var(--text-secondary)] font-medium text-sm
                hover:bg-[var(--bg)] hover:text-[var(--text)] hover:border-[var(--border)]/60
                transition-all duration-150 ease-out
                flex items-center justify-center gap-2
                focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50
              "
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy Debate Link
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
