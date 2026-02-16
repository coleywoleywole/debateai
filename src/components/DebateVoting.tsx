"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";

interface DebateVotingProps {
  debateId: string;
  userSideName?: string;
  opponentSideName?: string;
  initialUserPercent?: number; // For SSR or if user already voted
  initialOpponentPercent?: number;
  hasVoted?: boolean;
}

export default function DebateVoting({
  debateId,
  userSideName = "You",
  opponentSideName = "AI",
  initialUserPercent = 50,
  initialOpponentPercent = 50,
  hasVoted: initialHasVoted = false,
}: DebateVotingProps) {
  const [hasVoted, setHasVoted] = useState(initialHasVoted);
  const [isVoting, setIsVoting] = useState(false);
  const [results, setResults] = useState({
    user: initialUserPercent,
    opponent: initialOpponentPercent,
  });

  const handleVote = async (winner: "user" | "opponent") => {
    if (isVoting || hasVoted) return;

    setIsVoting(true);
    
    // Optimistic update - assume 1 vote shift
    // For now, just show random reasonable percentages if no real data
    // Or just increment local count if we had raw counts
    // Here we'll just mock a successful vote and show results
    
    track("debate_vote_cast", {
      debateId,
      winner,
      userSide: userSideName,
      opponentSide: opponentSideName,
    });

    try {
      // Call API
      const response = await fetch("/api/debate/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          debateId,
          winner,
        }),
      });

      if (!response.ok) {
        // If API fails, we still show the UI update for UX (optimistic)
        console.warn("Vote API failed, but showing UI update");
      } else {
        const data = await response.json();
        if (data.results) {
          setResults(data.results);
        }
      }

      // Simulate network delay for effect if too fast
      // await new Promise(r => setTimeout(r, 500));

      setHasVoted(true);
      
      // Update local storage to prevent re-voting (basic client-side check)
      localStorage.setItem(`voted_${debateId}`, "true");

    } catch (error) {
      console.error("Failed to cast vote:", error);
      // Still show voted state to prevent frustration
      setHasVoted(true);
    } finally {
      setIsVoting(false);
    }
  };

  if (hasVoted) {
    return (
      <div className="py-6 px-4">
        <div className="max-w-md mx-auto">
          <h3 className="text-center text-sm font-medium text-[var(--text-secondary)] mb-4 uppercase tracking-wide">
            Community Verdict
          </h3>
          
          <div className="space-y-4">
            {/* User Bar */}
            <div className="relative">
              <div className="flex justify-between text-sm font-medium mb-1">
                <span className="text-[var(--text)]">{userSideName}</span>
                <span className="text-[var(--accent)]">{results.user}%</span>
              </div>
              <div className="h-3 bg-[var(--bg-sunken)] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[var(--accent)] rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${results.user}%` }}
                />
              </div>
            </div>

            {/* Opponent Bar */}
            <div className="relative">
              <div className="flex justify-between text-sm font-medium mb-1">
                <span className="text-[var(--text)]">{opponentSideName}</span>
                <span className="text-orange-400">{results.opponent}%</span>
              </div>
              <div className="h-3 bg-[var(--bg-sunken)] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-orange-400 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${results.opponent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 text-center text-xs text-[var(--text-tertiary)]">
            Thanks for voting!
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 px-4 border-t border-[var(--border)]/50 bg-[var(--bg-elevated)]/20">
      <div className="max-w-md mx-auto text-center">
        <h3 className="text-lg font-semibold text-[var(--text)] mb-2">
          Who won this debate?
        </h3>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          Cast your vote to see what others think.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => handleVote("user")}
            disabled={isVoting}
            className="group relative p-4 rounded-xl bg-[var(--bg-elevated)] border-2 border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 transition-all duration-200"
          >
            <div className="absolute inset-0 bg-[var(--accent)]/5 opacity-0 group-hover:opacity-100 rounded-xl transition-opacity" />
            <div className="text-2xl mb-2">👤</div>
            <div className="font-semibold text-[var(--text)] group-hover:text-[var(--accent)]">
              {userSideName}
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">
              Vote for {userSideName === "You" ? "yourself" : "User"}
            </div>
          </button>

          <button
            onClick={() => handleVote("opponent")}
            disabled={isVoting}
            className="group relative p-4 rounded-xl bg-[var(--bg-elevated)] border-2 border-[var(--border)] hover:border-orange-400 hover:bg-orange-400/5 transition-all duration-200"
          >
            <div className="absolute inset-0 bg-orange-400/5 opacity-0 group-hover:opacity-100 rounded-xl transition-opacity" />
            <div className="text-2xl mb-2">🤖</div>
            <div className="font-semibold text-[var(--text)] group-hover:text-orange-400">
              {opponentSideName}
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">
              Vote for {opponentSideName}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
