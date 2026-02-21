'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface NotificationData {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

interface NotificationDropdownProps {
  notifications: NotificationData[];
  isLoading: boolean;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClose: () => void;
}

interface Preferences {
  streakWarning: boolean;
  challenge: boolean;
  scoreResult: boolean;
  milestone: boolean;
}

const TYPE_ICONS: Record<string, string> = {
  score_result: '📊',
  streak_warning: '⚠️',
  milestone: '🔥',
  challenge: '⚔️',
};

const TYPE_COLORS: Record<string, string> = {
  score_result: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  streak_warning: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  milestone: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  challenge: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
};

const PREF_LABELS: { key: keyof Preferences; label: string; description: string }[] = [
  { key: 'scoreResult', label: 'Debate Results', description: 'When your debates are scored' },
  { key: 'streakWarning', label: 'Streak Alerts', description: 'Before your streak expires' },
  { key: 'milestone', label: 'Milestones', description: 'Streak achievements (7, 14, 30 days)' },
  { key: 'challenge', label: 'Challenges', description: 'When someone challenges you' },
];

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return `${Math.floor(diffDay / 7)}w ago`;
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
        enabled ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 mt-0.5 ${
          enabled ? 'translate-x-[18px] ml-0' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export default function NotificationDropdown({
  notifications,
  isLoading,
  onMarkRead,
  onMarkAllRead,
  onClose,
}: NotificationDropdownProps) {
  const hasUnread = notifications.some((n) => !n.read);
  const [showSettings, setShowSettings] = useState(false);
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [prefsLoading, setPrefsLoading] = useState(false);

  const fetchPrefs = useCallback(async () => {
    setPrefsLoading(true);
    try {
      const res = await fetch('/api/notifications/preferences');
      if (res.ok) {
        const data = await res.json();
        setPrefs(data.preferences);
      }
    } catch {
      // silent
    } finally {
      setPrefsLoading(false);
    }
  }, []);

  // Load preferences when settings view opens
  useEffect(() => {
    if (showSettings && !prefs) {
      fetchPrefs();
    }
  }, [showSettings, prefs, fetchPrefs]);

  const updatePref = async (key: keyof Preferences, value: boolean) => {
    if (!prefs) return;
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    try {
      await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
    } catch {
      // Revert on failure
      setPrefs(prefs);
    }
  };

  return (
    <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 max-h-[70vh] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg)] shadow-2xl shadow-black/10 z-[100] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border)] bg-[var(--bg-elevated)]">
        <div className="flex items-center gap-2">
          {showSettings && (
            <button
              onClick={() => setShowSettings(false)}
              className="text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors mr-1"
              aria-label="Back to notifications"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <h3 className="text-sm font-semibold text-[var(--text)]">
            {showSettings ? 'Settings' : 'Notifications'}
          </h3>
          {!showSettings && hasUnread && (
            <span className="flex h-2 w-2 rounded-full bg-[var(--accent)]"></span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!showSettings && hasUnread && (
            <button
              onClick={onMarkAllRead}
              disabled={isLoading}
              className="text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors disabled:opacity-50"
            >
              Mark all read
            </button>
          )}
          {!showSettings && (
            <button
              onClick={() => setShowSettings(true)}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
              aria-label="Notification settings"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Settings view */}
      {showSettings ? (
        <div className="overflow-y-auto flex-1">
          {prefsLoading || !prefs ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
            </div>
          ) : (
            <div className="py-2">
              <p className="px-4 py-2 text-xs text-[var(--text-tertiary)]">
                Choose which in-app notifications you receive.
              </p>
              {PREF_LABELS.map(({ key, label, description }) => (
                <div
                  key={key}
                  className="flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-sunken)] transition-colors"
                >
                  <div className="min-w-0 mr-3">
                    <p className="text-[13px] font-medium text-[var(--text)]">{label}</p>
                    <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{description}</p>
                  </div>
                  <Toggle enabled={prefs[key]} onChange={(v) => updatePref(key, v)} />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Notification list */
        <div className="overflow-y-auto flex-1">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--bg-sunken)] flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                  />
                </svg>
              </div>
              <p className="text-sm text-[var(--text-secondary)]">No notifications yet</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-1">We&apos;ll notify you when something happens</p>
            </div>
          ) : (
            notifications.map((notif) => {
              const colorClass = TYPE_COLORS[notif.type] || 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/20';
              const content = (
                <div
                  onClick={() => {
                    if (!notif.read) onMarkRead(notif.id);
                    if (notif.link) onClose();
                  }}
                  className={`group flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors hover:bg-[var(--bg-sunken)] ${
                    !notif.read ? 'bg-[var(--accent)]/[0.03]' : ''
                  }`}
                >
                  {/* Type icon with colored background */}
                  <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-base border ${colorClass}`}>
                    {TYPE_ICONS[notif.type] || '🔔'}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className={`text-[13px] leading-snug ${!notif.read ? 'font-medium text-[var(--text)]' : 'text-[var(--text-secondary)]'}`}>
                      {notif.title}
                    </p>
                    {notif.message && (
                      <p className="text-xs text-[var(--text-tertiary)] mt-0.5 line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>
                    )}
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-1.5 tabular-nums">
                      {timeAgo(notif.createdAt)}
                    </p>
                  </div>

                  {/* Unread dot */}
                  {!notif.read && (
                    <div className="flex-shrink-0 mt-2">
                      <span className="flex h-2 w-2 rounded-full bg-[var(--accent)]"></span>
                    </div>
                  )}
                </div>
              );

              if (notif.link) {
                return (
                  <Link key={notif.id} href={notif.link} className="block">
                    {content}
                  </Link>
                );
              }
              return <div key={notif.id}>{content}</div>;
            })
          )}
        </div>
      )}
    </div>
  );
}
