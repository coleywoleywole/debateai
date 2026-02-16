'use client';

import { useState, useEffect, useRef } from 'react';
import { isFirstCompletion, markFirstCompletion } from '@/lib/onboarding';
import { track } from '@/lib/analytics';

interface Props {
  winner: 'user' | 'ai' | 'draw';
  userScore: number;
  aiScore: number;
}

// Lightweight confetti — creates 40 particles with CSS-only animation
function Confetti() {
  const colors = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4'];
  const particles = useRef(
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      color: colors[i % colors.length],
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 0.6}s`,
      duration: `${1.2 + Math.random() * 1}s`,
      size: `${4 + Math.random() * 4}px`,
      rotation: `${Math.random() * 360}deg`,
    })),
  ).current;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" aria-hidden>
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute animate-confetti-fall"
          style={{
            left: p.left,
            top: '-8px',
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '1px',
            animationDelay: p.delay,
            animationDuration: p.duration,
            transform: `rotate(${p.rotation})`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Celebration banner shown the first time a user completes a debate (gets scored).
 * Shows confetti, a congratulatory message, and hype copy based on the result.
 */
export default function FirstDebateCelebration({ winner, userScore, aiScore }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isFirstCompletion()) {
      setShow(true);
      markFirstCompletion();
      track('onboarding_completed', { winner, userScore, aiScore });
    }
  }, [winner, userScore, aiScore]);

  if (!show) return null;

  const headline =
    winner === 'user'
      ? '🏆 You won your first debate!'
      : winner === 'draw'
        ? '🤝 A draw on your first try — impressive'
        : '💪 Tough loss — but you showed up';

  const subtext =
    winner === 'user'
      ? 'That was seriously good. Most people don\'t win their first one.'
      : winner === 'draw'
        ? 'Matching an AI opponent on your first debate is no small feat.'
        : 'The best debaters lose before they win. Ready for round two?';

  return (
    <div className="relative rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-5 mb-4 overflow-hidden animate-fade-up">
      <Confetti />

      <div className="relative z-10 text-center">
        <h3 className="text-lg font-semibold text-[var(--text)] mb-1">
          {headline}
        </h3>
        <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
          {subtext}
        </p>
      </div>
    </div>
  );
}
