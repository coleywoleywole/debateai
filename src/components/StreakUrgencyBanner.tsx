'use client';

import { useState, useEffect } from 'react';
import { useSafeUser } from '@/lib/useSafeClerk';

/**
 * Urgency banner: "Your X-day streak ends in Y hours!"
 * Only shows for signed-in users who have a streak > 1 and haven't debated today.
 */
export default function StreakUrgencyBanner() {
  const { isSignedIn } = useSafeUser();
  const [show, setShow] = useState(false);
  const [streakCount, setStreakCount] = useState(0);
  const [hoursLeft, setHoursLeft] = useState(0);

  useEffect(() => {
    if (!isSignedIn) return;

    const fetchStreak = async () => {
      try {
        const res = await fetch('/api/user/streak');
        if (!res.ok) return;
        const data = await res.json();

        // Only show if streak > 1 and NOT debated today
        if (data.currentStreak > 1 && !data.debatedToday) {
          setStreakCount(data.currentStreak);

          // Calculate hours until midnight UTC
          const now = new Date();
          const midnight = new Date(now);
          midnight.setUTCDate(midnight.getUTCDate() + 1);
          midnight.setUTCHours(0, 0, 0, 0);
          const hours = Math.ceil((midnight.getTime() - now.getTime()) / (1000 * 60 * 60));
          setHoursLeft(hours);
          setShow(true);
        }
      } catch {
        // Silently fail
      }
    };

    fetchStreak();
  }, [isSignedIn]);

  if (!show) return null;

  return (
    <div className="w-full max-w-2xl mx-auto mb-6 animate-fade-up">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-orange-500/25 shadow-sm">
        {/* Decorative gradient line */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />
        
        <div className="flex items-center gap-3 px-5 py-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-lg shadow-sm">
            🔥
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-orange-700 dark:text-orange-300">
              Your {streakCount}-day streak ends in {hoursLeft} {hoursLeft === 1 ? 'hour' : 'hours'}!
            </p>
            <p className="text-xs text-orange-600/80 dark:text-orange-400/80 mt-0.5">
              Debate now to keep it alive
            </p>
          </div>          
          <button
            onClick={() => {
              // Scroll to input area
              document.querySelector('[data-onboarding="input"]')?.scrollIntoView({ behavior: 'smooth' });
              (document.querySelector('[data-onboarding="input"] textarea') as HTMLTextAreaElement)?.focus();
            }}
            className="flex-shrink-0 px-4 py-2 rounded-lg text-xs font-semibold bg-orange-500 text-white hover:bg-orange-600 active:scale-95 transition-all shadow-sm shadow-orange-500/25"
          >
            Debate now
          </button>
        </div>
      </div>
    </div>
  );
}
