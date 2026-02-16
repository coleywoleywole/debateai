import React from 'react';

export type Round = 'opening' | 'rebuttal' | 'closing' | 'complete';

export function getRound(messageCount: number): Round {
  if (messageCount >= 6) return 'complete';
  if (messageCount >= 4) return 'closing';
  if (messageCount >= 2) return 'rebuttal';
  return 'opening';
}

export default function DebateProgress({ messageCount }: { messageCount: number }) {
  const currentRound = getRound(messageCount);

  const steps = [
    { id: 'opening', label: 'Opening' },
    { id: 'rebuttal', label: 'Rebuttal' },
    { id: 'closing', label: 'Closing' },
  ];

  return (
    <div className="sticky top-14 z-40 w-full bg-[var(--bg)]/95 backdrop-blur-md border-b border-[var(--border)] transition-all duration-300">
      <div className="max-w-xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between py-3 relative">
          {/* Progress Line Background */}
          <div className="absolute top-[18px] left-0 w-full h-[2px] bg-[var(--bg-sunken)] -z-10" />
          
          {/* Active Progress Line */}
          <div 
            className="absolute top-[18px] left-0 h-[2px] bg-[var(--accent)] -z-10 transition-all duration-500 ease-out"
            style={{ 
              width: currentRound === 'opening' ? '0%' : 
                     currentRound === 'rebuttal' ? '50%' : 
                     currentRound === 'closing' ? '100%' : '100%' 
            }}
          />
          
          {steps.map((step) => {
            const isActive = currentRound === step.id;
            const isCompleted = 
              (currentRound === 'rebuttal' && step.id === 'opening') ||
              (currentRound === 'closing' && (step.id === 'opening' || step.id === 'rebuttal')) ||
              (currentRound === 'complete');

            return (
              <div key={step.id} className="flex flex-col items-center gap-1.5 z-10">
                <div 
                  className={`
                    w-2.5 h-2.5 rounded-full transition-all duration-300
                    ${isActive 
                      ? 'bg-[var(--accent)] scale-125 ring-4 ring-[var(--accent)]/20' 
                      : isCompleted 
                        ? 'bg-[var(--accent)]' 
                        : 'bg-[var(--bg-sunken)] ring-4 ring-[var(--bg)]'
                    }
                  `}
                />
                <span 
                  className={`
                    text-[10px] uppercase tracking-wider font-semibold transition-colors duration-300 bg-[var(--bg)] px-2 rounded-full
                    ${isActive ? 'text-[var(--accent)]' : isCompleted ? 'text-[var(--text)]' : 'text-[var(--text-tertiary)]'}
                  `}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
