"use client";

import React from "react";

interface QuickRepliesProps {
  onReply: (text: string) => void;
  onJudge?: () => void;
  disabled?: boolean;
}

const SUGGESTIONS = [
  "Why?",
  "I disagree.",
  "Give me evidence.",
  "Explain further.",
  "That's a fair point.",
  "What's your source?",
];

export default function QuickReplies({ onReply, onJudge, disabled }: QuickRepliesProps) {
  return (
    <div className="flex flex-wrap gap-2 px-4 py-2 max-w-3xl mx-auto overflow-x-auto no-scrollbar">
      {SUGGESTIONS.map((suggestion) => (
        <button
          key={suggestion}
          onClick={() => onReply(suggestion)}
          disabled={disabled}
          className="whitespace-nowrap px-3 py-1.5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] 
            text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/30 
            hover:bg-[var(--accent)]/5 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
            cursor-pointer"
        >
          {suggestion}
        </button>
      ))}
      
      {onJudge && (
        <button
          onClick={onJudge}
          disabled={disabled}
          className="whitespace-nowrap px-3 py-1.5 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/30 
            text-xs font-bold text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-all 
            active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
        >
          <span>⚖️ End & Judge</span>
        </button>
      )}
    </div>
  );
}
