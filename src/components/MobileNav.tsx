'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSafeUser } from '@/lib/useSafeClerk';

const NAV_ITEMS = [
  {
    label: 'Home',
    href: '/',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: 'Custom Debate',
    href: '/debate',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
      </svg>
    ),
  },
  {
    label: 'History',
    href: '/history',
    requiresAuth: true,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: 'Past Topics',
    href: '/topics/history',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    label: 'Explore',
    href: '/explore',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 11l2 2-2 2-2-2 2-2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.5 9.5L12 12l-2.5 2.5" />
      </svg>
    ),
  },
  {
    label: 'Blog',
    href: '/blog',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
      </svg>
    ),
  },
  {
    label: 'Compare',
    href: '/compare/debateai-vs-chatgpt',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
];

export default function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const { isSignedIn } = useSafeUser();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setIsOpen(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  const filteredItems = NAV_ITEMS.filter(
    (item) => !item.requiresAuth || isSignedIn
  );

  return (
    <>
      {/* Hamburger button — visible only on mobile */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="sm:hidden relative w-9 h-9 rounded-lg flex items-center justify-center
          text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--bg-sunken)]
          transition-colors cursor-pointer"
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={isOpen}
        aria-controls="mobile-nav-panel"
      >
        {/* Animated hamburger → X */}
        <div className="w-5 h-4 relative flex flex-col justify-between">
          <span
            className={`block h-[1.5px] w-full bg-current rounded-full transition-all duration-300 origin-center
              ${isOpen ? 'translate-y-[7px] rotate-45' : ''}`}
          />
          <span
            className={`block h-[1.5px] w-full bg-current rounded-full transition-all duration-200
              ${isOpen ? 'opacity-0 scale-x-0' : ''}`}
          />
          <span
            className={`block h-[1.5px] w-full bg-current rounded-full transition-all duration-300 origin-center
              ${isOpen ? '-translate-y-[7px] -rotate-45' : ''}`}
          />
        </div>
      </button>

      {/* Portal the menu to document.body to escape sticky/blur stacking contexts */}
      {mounted && createPortal(
        <>
          {/* Overlay */}
          <div
            className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-[99] transition-opacity duration-300 sm:hidden
              ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Slide-down panel */}
          <nav
            id="mobile-nav-panel"
            className={`fixed top-[57px] left-0 right-0 z-[100] sm:hidden
              bg-[var(--bg)] border-b border-[var(--border)]
              shadow-xl shadow-black/10
              transition-all duration-300 ease-out
              ${isOpen
                ? 'translate-y-0 opacity-100'
                : '-translate-y-4 opacity-0 pointer-events-none'
              }`}
            role="navigation"
            aria-label="Mobile navigation"
          >
            <div className="px-4 py-3 max-h-[calc(100dvh-57px)] overflow-y-auto">
              <ul className="space-y-1">
                {filteredItems.map((item) => {
                  const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-3 rounded-xl text-[15px] font-medium transition-all duration-150 cursor-pointer
                          ${isActive
                            ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                            : 'text-[var(--text)] hover:bg-[var(--bg-sunken)]'
                          }`}
                      >
                        <span className={isActive ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}>
                          {item.icon}
                        </span>
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </nav>
        </>,
        document.body
      )}
    </>
  );
}
