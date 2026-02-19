'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSafeUser, useSafeClerk } from '@/lib/useSafeClerk';
import Link from 'next/link';
import Header from '@/components/Header';
import UpgradeModal from '@/components/UpgradeModal';
import { useSubscription } from '@/lib/useSubscription';
import { HistoryPageSkeleton } from '@/components/Skeleton';

interface Debate {
  id: string;
  opponent: string;
  opponentStyle?: string;
  topic: string;
  messageCount: number;
  createdAt: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useSafeUser();
  const { openSignIn } = useSafeClerk();
  const { isPremium, debatesUsed, debatesLimit } = useSubscription();
  const [debates, setDebates] = useState<Debate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    if (isLoaded) {
      fetchDebates();
    }
  }, [isLoaded]);

  const fetchDebates = async () => {
    try {
      setError(null);
      const response = await fetch('/api/debates', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setDebates(data.debates || []);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to fetch debates:', response.status, errorData);
        
        // Only show error message if it's not a 401 (we handle signed-out separately)
        if (response.status !== 401) {
          setError('Unable to load your debates. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error fetching debates:', error);
      setError('Unable to connect. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredDebates = debates.filter(debate => {
    const topic = String(debate.topic || '').toLowerCase();
    const style = String(debate.opponentStyle || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    return topic.includes(query) || style.includes(query);
  });

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Unknown date';
      
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffHours < 1) return 'Just now';
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return 'Recent';
    }
  };

  const handleSignIn = () => {
    openSignIn();
  };

  return (
    <div className="min-h-dvh flex flex-col relative overflow-hidden">
      <Header />
      
      <main className="flex-1 px-5 py-6 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="text-center sm:text-left">
              <div className="inline-flex items-center gap-2 mb-2">
                <span className="h-px w-4 bg-gradient-to-r from-transparent to-[var(--accent)] opacity-50" />
                <span className="text-[10px] font-medium text-[var(--accent)] uppercase tracking-[0.2em]">
                  Your Debates
                </span>
              </div>
              <h1 className="text-2xl font-serif font-semibold text-[var(--text)]">History</h1>
              <p className="text-xs text-[var(--text-secondary)] mt-1">Continue where you left off</p>
            </div>
            <Link 
              href="/" 
              className="h-9 px-4 rounded-lg bg-[var(--accent)] text-white text-sm font-medium flex items-center justify-center gap-2 self-center sm:self-start shadow-lg shadow-[var(--accent)]/25 hover:shadow-xl hover:shadow-[var(--accent)]/40 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
              </svg>
              New Debate
            </Link>
          </div>

          {/* Upgrade Banner */}
          {!isPremium && debatesUsed !== undefined && debatesUsed >= 2 && isSignedIn && (
            <div className="mb-5 p-4 rounded-xl bg-[var(--accent)]/5 border border-[var(--accent)]/20">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text)]">
                      {debatesLimit && debatesUsed >= debatesLimit 
                        ? 'You have reached your debate limit'
                        : `${debatesLimit ? debatesLimit - debatesUsed : 0} free debates remaining`
                      }
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Upgrade for unlimited access
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowUpgradeModal(true)} 
                  className="h-8 px-3 rounded-lg bg-[var(--accent)] text-white text-xs font-medium hover:bg-[var(--accent-hover)] transition-colors"
                >
                  Upgrade
                </button>
              </div>
            </div>
          )}

          {/* Search */}
          {(isSignedIn || debates.length > 0) && (
            <div className="relative mb-5">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input
                type="text"
                placeholder="Search debates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[var(--bg-elevated)] border border-[var(--border)]/30 rounded-xl pl-10 pr-4 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-tertiary)] outline-none focus:border-[var(--accent)]/50 transition-colors"
              />
            </div>
          )}

          {/* Loading State */}
          {isLoading && <HistoryPageSkeleton />}

          {/* Signed Out & No Debates State */}
          {!isSignedIn && !isLoading && !error && debates.length === 0 && (
            <div className="relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--accent)]/20 to-[var(--accent-light)]/20 rounded-2xl blur-lg opacity-50" />
              <div className="relative artistic-card p-8 text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-[var(--text)] mb-2">Sign in to view history</h3>
                <p className="text-sm text-[var(--text-secondary)] mb-5">
                  Your debates are saved to your account
                </p>
                <button 
                  onClick={handleSignIn}
                  className="h-10 px-5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors shadow-lg shadow-[var(--accent)]/25"
                >
                  Sign In
                </button>
              </div>
            </div>
          )}

          {/* Error State */}
          {!isLoading && error && (
            <div className="text-center py-12">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
              </div>
              <p className="text-sm text-[var(--text-secondary)] mb-4">{error}</p>
              <button
                onClick={() => { setIsLoading(true); fetchDebates(); }}
                className="h-9 px-4 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Empty State (Signed In or Guest with No Debates) */}
          {!isLoading && !error && debates.length === 0 && isSignedIn && (
            <div className="text-center py-16">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border)]/30 flex items-center justify-center">
                <svg className="w-6 h-6 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                </svg>
              </div>
              <h3 className="text-base font-medium text-[var(--text)] mb-1">
                No debates yet
              </h3>
              <p className="text-sm text-[var(--text-secondary)] mb-5">
                Start your first debate to see it here
              </p>
              <Link 
                href="/" 
                className="h-9 px-5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium inline-flex items-center gap-2 shadow-lg shadow-[var(--accent)]/25 hover:shadow-xl hover:shadow-[var(--accent)]/40 transition-all"
              >
                Start Your First Debate
              </Link>
            </div>
          )}

          {/* No Matches Search Result */}
          {!isLoading && !error && debates.length > 0 && filteredDebates.length === 0 && (
            <div className="text-center py-16 text-[var(--text-secondary)]">
              <p className="text-sm">No matches found for "{searchQuery}"</p>
            </div>
          )}

          {/* Debates List */}
          {!isLoading && filteredDebates.length > 0 && (
            <div className="space-y-3">
              {filteredDebates.map((debate, index) => (
                <div
                  key={debate.id}
                  onClick={() => router.push(`/debate/${debate.id}`)}
                  className="group relative cursor-pointer animate-fade-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Glow on hover */}
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--accent)]/0 to-[var(--accent)]/0 group-hover:from-[var(--accent)]/10 group-hover:to-[var(--accent-light)]/10 rounded-xl blur opacity-0 group-hover:opacity-100 transition-all duration-300" />
                  
                  <div className="relative artistic-card p-4 hover:border-[var(--accent)]/30 transition-all duration-300">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-[var(--text)] text-sm mb-1.5 line-clamp-2 group-hover:text-[var(--accent)] transition-colors">
                          {debate.topic}
                        </h3>
                        
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]">
                          {debate.opponentStyle && (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-1 h-1 rounded-full bg-[var(--accent)]"/>
                              vs {debate.opponentStyle}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
                            </svg>
                            {debate.messageCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            {formatDate(debate.createdAt)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex-shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-7 h-7 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer Stats */}
          {debates.length > 0 && !isLoading && (
            <div className="mt-6 pt-4 border-t border-[var(--border)]/30 text-center">
              <p className="text-xs text-[var(--text-secondary)]">
                {debates.length} debate{debates.length !== 1 ? 's' : ''}
                {filteredDebates.length !== debates.length && ` • Showing ${filteredDebates.length}`}
              </p>
            </div>
          )}
        </div>
      </main>

      <UpgradeModal 
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        trigger="rate-limit-debate"
        limitData={{ current: debatesUsed || 0, limit: debatesLimit || 3 }}
      />
    </div>
  );
}
