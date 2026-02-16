'use client';

import { useState, useEffect, useCallback } from 'react';
import { isNewUser, markOnboarded } from '@/lib/onboarding';
import { track } from '@/lib/analytics';

interface Step {
  target: string;       // CSS selector for the element to highlight
  title: string;
  body: string;
  position: 'top' | 'bottom';
}

const STEPS: Step[] = [
  {
    target: '[data-onboarding="topic"]',
    title: "Today's topic is ready",
    body: 'A fresh debate topic every day. Read it, form an opinion — you\'re about to defend it.',
    position: 'bottom',
  },
  {
    target: '[data-onboarding="input"]',
    title: 'Type your opening argument',
    body: 'Just a sentence or two is fine. Say what you think and why.',
    position: 'top',
  },
  {
    target: '[data-onboarding="cta"]',
    title: "Hit Start Debate — you've got this",
    body: 'Your AI opponent will push back. Stay sharp, make your case.',
    position: 'top',
  },
];

/**
 * Lightweight onboarding overlay — 3 tooltip steps for first-time users.
 * Renders a semi-transparent backdrop with a spotlight on the target element.
 * Dismissed on completing steps or clicking the backdrop.
 */
export default function OnboardingOverlay() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Only show for new users, after a short delay so the page renders
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isNewUser()) {
        setShow(true);
        track('onboarding_landed', {});
      }
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  // Position the tooltip relative to the target element
  const updatePosition = useCallback(() => {
    if (!show) return;
    const el = document.querySelector(STEPS[step].target);
    if (el) {
      setRect(el.getBoundingClientRect());
    }
  }, [show, step]);

  useEffect(() => {
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [updatePosition]);

  const dismiss = useCallback(() => {
    setShow(false);
    markOnboarded();
  }, []);

  const advance = useCallback(() => {
    track('onboarding_step_viewed', { step: step + 1, total: STEPS.length });
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      dismiss();
    }
  }, [step, dismiss]);

  if (!show || !rect) return null;

  const current = STEPS[step];
  const padding = 8; // px around the spotlight

  // Tooltip position
  const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.max(16, Math.min(rect.left, window.innerWidth - 320)),
    zIndex: 10002,
    width: Math.min(304, window.innerWidth - 32),
  };

  if (current.position === 'bottom') {
    tooltipStyle.top = rect.bottom + padding + 12;
  } else {
    tooltipStyle.bottom = window.innerHeight - rect.top + padding + 12;
  }

  return (
    <>
      {/* Backdrop — click to dismiss, allows click-through on spotlight */}
      <svg 
        className="fixed inset-0 z-[10000] w-full h-full pointer-events-none"
        aria-hidden="true"
      >
        <path
          d={`M0,0 H${window.innerWidth} V${window.innerHeight} H0 Z 
              M${rect.left - padding},${rect.top - padding} 
              h${rect.width + padding * 2} 
              v${rect.height + padding * 2} 
              h-${rect.width + padding * 2} Z`}
          fill="rgba(0,0,0,0.55)"
          fillRule="evenodd"
          className="pointer-events-auto cursor-default"
          onClick={dismiss}
        />
      </svg>

      {/* Spotlight ring */}
      <div
        className="fixed z-[10001] pointer-events-none rounded-2xl ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-transparent"
        style={{
          top: rect.top - padding,
          left: rect.left - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
        }}
      />

      {/* Tooltip card */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={tooltipStyle}
        className="fixed z-[10002] animate-fade-up"
      >
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl p-4">
          {/* Step indicator */}
          <div className="flex items-center gap-1.5 mb-2">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === step
                    ? 'w-5 bg-[var(--accent)]'
                    : i < step
                      ? 'w-2 bg-[var(--accent)]/40'
                      : 'w-2 bg-[var(--border)]'
                }`}
              />
            ))}
          </div>

          <h3 className="text-sm font-semibold text-[var(--text)] mb-1">
            {current.title}
          </h3>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3">
            {current.body}
          </p>

          <div className="flex items-center justify-between">
            <button
              onClick={dismiss}
              className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
            >
              Skip
            </button>
            <button
              onClick={advance}
              className="text-xs font-medium text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-3 py-1.5 rounded-lg transition-colors"
            >
              {step < STEPS.length - 1 ? 'Next' : 'Got it'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
