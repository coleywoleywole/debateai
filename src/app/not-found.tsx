/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';

export const metadata = {
  title: 'Page Not Found | DebateAI',
  description: 'The page you are looking for does not exist.',
};

export default function NotFoundPage() {
  return (
    <div className="min-h-dvh flex flex-col relative overflow-hidden">
      {/* Minimal header — no Clerk dependency for static prerender */}
      <header className="sticky top-0 z-50 border-b border-[var(--border)]/30 bg-[var(--bg)]/50 backdrop-blur-xl">
        <div className="container-wide">
          <div className="flex items-center h-14">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="relative w-8 h-8 rounded-lg overflow-hidden">
                <img
                  src="/logo-icon.png"
                  alt="DebateAI"
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-[15px] font-semibold text-[var(--text)] tracking-tight">
                DebateAI
              </span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-5 py-12">
        <div className="text-center max-w-md">
          <h1 className="text-7xl font-bold text-[var(--text)] mb-3">404</h1>
          <p className="text-lg text-[var(--text-secondary)] mb-4">Page not found</p>
          <p className="text-sm text-[var(--text-tertiary)] mb-8">
            This page doesn't exist or may have been moved.
          </p>

          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl bg-[var(--accent)] text-white font-medium shadow-lg shadow-[var(--accent)]/25 hover:shadow-xl hover:shadow-[var(--accent)]/40 transition-all"
          >
            Go Home
          </Link>
        </div>
      </main>
    </div>
  );
}
