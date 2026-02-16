'use client';

import { useState } from 'react';
import { useSafeUser, useSafeClerk } from '@/lib/useSafeClerk';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import UpgradeModal from '@/components/UpgradeModal';
import Header from '@/components/Header';
import { useSubscription } from '@/lib/useSubscription';

export default function DebatePage() {
  const { isSignedIn } = useSafeUser();
  const { openSignIn } = useSafeClerk();
  const router = useRouter();
  const { isPremium, debatesUsed, debatesLimit } = useSubscription();
  const [opponentStyle, setOpponentStyle] = useState('');
  const [topic, setTopic] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  
  const [upgradeModal, setUpgradeModal] = useState<{
    isOpen: boolean;
    trigger: 'rate-limit-debate' | 'rate-limit-message' | 'button';
    limitData?: { current: number; limit: number };
  }>({ isOpen: false, trigger: 'button' });

  const startDebate = async () => {
    if (!opponentStyle.trim() || !topic.trim()) return;
    
    if (!isSignedIn) {
      openSignIn();
      return;
    }
    
    setIsStarting(true);
    const debateId = crypto.randomUUID();
    
    try {
      const response = await fetch('/api/debate/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character: 'custom',
          opponentStyle,
          topic,
          debateId
        })
      });
      
      if (response.ok) {
        // Backend tracks debate_created with experiment_variant - avoid duplicate tracking
        router.push(`/debate/${debateId}`);
      } else {
        const error = await response.json();
        if (response.status === 429 && error.error === 'debate_limit_exceeded') {
          setUpgradeModal({
            isOpen: true,
            trigger: 'rate-limit-debate',
            limitData: { current: error.current, limit: error.limit }
          });
        } else {
          alert('Failed to create debate. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error creating debate:', error);
      alert('Failed to create debate. Please try again.');
    } finally {
      setIsStarting(false);
    }
  };

  const remaining = (text: string, max: number) => max - text.length;

  return (
    <div className="min-h-dvh flex flex-col relative overflow-hidden">
      <UpgradeModal
        isOpen={upgradeModal.isOpen}
        onClose={() => setUpgradeModal(prev => ({ ...prev, isOpen: false }))}
        trigger={upgradeModal.trigger}
        limitData={upgradeModal.limitData}
      />
      
      <Header />

      <main className="flex-1 flex items-center justify-center px-5 py-4">
        <div className="w-full max-w-xl">
          
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="h-px w-6 bg-gradient-to-r from-transparent to-[var(--accent)] opacity-50" />
              <span className="text-[10px] font-medium text-[var(--accent)] uppercase tracking-[0.2em]">
                Advanced Setup
              </span>
              <span className="h-px w-6 bg-gradient-to-l from-transparent to-[var(--accent)] opacity-50" />
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-serif font-semibold text-[var(--text)] mb-2 px-1 break-words whitespace-normal w-full">
              Custom Debate
            </h1>
            <p className="text-sm text-[var(--text-secondary)] break-words px-1">Choose your opponent and topic</p>
            
            {!isPremium && debatesUsed !== undefined && debatesLimit !== undefined && (
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs bg-[var(--accent)]/5 border border-[var(--accent)]/20">
                <span className="text-[var(--text-secondary)]">Free debates:</span>
                <span className={`font-medium ${debatesUsed >= debatesLimit ? 'text-[var(--error)]' : 'text-[var(--accent)]'}`}>
                  {debatesLimit - debatesUsed} left
                </span>
                <button 
                  onClick={() => setUpgradeModal({ isOpen: true, trigger: 'button', limitData: { current: debatesUsed, limit: debatesLimit }})}
                  className="text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium hover:underline"
                >
                  Upgrade
                </button>
              </div>
            )}
          </div>

          {/* Form Card */}
          <div className="relative">
            {/* Glow */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--accent)]/20 to-[var(--accent-light)]/20 rounded-2xl blur-lg opacity-50" />
            
            <div className="relative artistic-card p-6 space-y-5">
              {/* Opponent Field */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="opponent" className="text-sm font-medium text-[var(--text)]">
                    Your Opponent
                  </label>
                  <span className="text-[10px] font-mono text-[var(--text-tertiary)]">
                    {remaining(opponentStyle, 200)} / 200
                  </span>
                </div>
                <textarea
                  id="opponent"
                  value={opponentStyle}
                  onChange={(e) => { if (e.target.value.length <= 200) setOpponentStyle(e.target.value); }}
                  placeholder="e.g., Elon Musk, Socratic philosopher, Devil's advocate..."
                  className="w-full bg-transparent border border-[var(--border)]/30 rounded-xl px-4 py-3 text-[var(--text)] placeholder-[var(--text-tertiary)] min-h-[80px] resize-none outline-none focus:border-[var(--accent)]/50 transition-colors"
                />
              </div>

              {/* Topic Field */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="topic" className="text-sm font-medium text-[var(--text)]">
                    Debate Topic
                  </label>
                  <span className="text-[10px] font-mono text-[var(--text-tertiary)]">
                    {remaining(topic, 200)} / 200
                  </span>
                </div>
                <textarea
                  id="topic"
                  value={topic}
                  onChange={(e) => { if (e.target.value.length <= 200) setTopic(e.target.value); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) startDebate(); }}
                  placeholder="What do you want to debate?"
                  className="w-full bg-transparent border border-[var(--border)]/30 rounded-xl px-4 py-3 text-[var(--text)] placeholder-[var(--text-tertiary)] min-h-[80px] resize-none outline-none focus:border-[var(--accent)]/50 transition-colors"
                />
              </div>

              {/* Submit */}
              <div className="pt-2 space-y-3">
                <button
                  onClick={startDebate}
                  disabled={!opponentStyle.trim() || !topic.trim() || isStarting}
                  className={`w-full h-11 px-6 rounded-xl font-medium text-sm transition-all duration-300 flex items-center justify-center gap-2
                    ${opponentStyle.trim() && topic.trim() && !isStarting
                      ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/30 hover:shadow-xl hover:shadow-[var(--accent)]/40 hover:-translate-y-0.5'
                      : 'bg-[var(--bg-sunken)] text-[var(--text-tertiary)] cursor-not-allowed'
                    }`}
                >
                  {isStarting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                      </svg>
                      Starting...
                    </>
                  ) : (
                    <>
                      <span className="whitespace-nowrap">Start Debate</span>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                      </svg>
                    </>
                  )}
                </button>
                
                <p className="text-center text-[10px] text-[var(--text-tertiary)]">
                  <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-sunken)]/50 border border-[var(--border)]/30 text-[9px] font-mono">⌘</kbd>
                  <span className="mx-1">+</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-sunken)]/50 border border-[var(--border)]/30 text-[9px] font-mono">Enter</kbd>
                </p>
              </div>
            </div>
          </div>

          {/* Footer Links */}
          <div className="mt-8 flex items-center justify-center gap-6 text-xs text-[var(--text-secondary)]">
            <Link href="/" className="hover:text-[var(--text)] transition-colors flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
              </svg>
              Quick Start
            </Link>
            <span className="w-1 h-1 rounded-full bg-[var(--border-strong)]"/>
            <Link href="/history" className="hover:text-[var(--text)] transition-colors flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              History
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
