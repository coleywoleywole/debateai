import React from 'react';

export default function TurnCounter({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-[var(--bg-sunken)] border border-[var(--border)]">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Turn</span>
      <span className="text-xs font-semibold text-[var(--accent)]">{count}</span>
    </div>
  );
}
