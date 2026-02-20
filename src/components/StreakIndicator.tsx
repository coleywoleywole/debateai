'use client';

import { useState, useEffect } from 'react';
import { useSafeUser } from '@/lib/useSafeClerk';

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  totalPoints: number;
  debatedToday: boolean;
}

/**
 * Compact 🔥 streak badge. Shows current streak count.
 * Only renders for signed-in users with an active streak.
 */
export default function StreakIndicator() {
  const { isSignedIn } = useSafeUser();
  const [streak, setStreak] = useState<StreakData | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;

    const fetchStreak = async () => {
      try {
        const res = await fetch('/api/user/streak');
        if (res.ok) {
          const data = await res.json();
          setStreak(data);
        }
      } catch {
        // Silently fail — streak badge is non-critical
      }
    };

    fetchStreak();
  }, [isSignedIn]);

  if (!streak || streak.currentStreak === 0) return null;

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-gradient-to-br from-orange-500/15 to-amber-500/10 border border-orange-500/25 text-orange-600 shadow-sm"
      title={`${streak.currentStreak}-day debate streak! ${streak.totalPoints} total points`}
    >
      <span className="text-sm">🔥</span>
      <span className="text-xs font-bold tabular-nums">{streak.currentStreak}</span>
    </div>
  );
}
