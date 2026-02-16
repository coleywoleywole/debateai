import Link from 'next/link';
import Header from '@/components/Header';
import type { PageContent } from '@/lib/pages';

interface SeoPageLayoutProps {
  page: PageContent;
  backLink: { href: string; label: string };
}

/** All SEO landing pages for cross-linking. */
const ALL_RESOURCES = [
  {
    href: '/compare/debateai-vs-chatgpt',
    category: 'compare',
    slug: 'debateai-vs-chatgpt',
    title: 'DebateAI vs ChatGPT for Debate Practice',
    description: 'Purpose-built debate tool vs general AI — which is better for practice?',
  },
  {
    href: '/tools/best-ai-debate-tools-2026',
    category: 'tools',
    slug: 'best-ai-debate-tools-2026',
    title: '7 Best AI Debate Tools in 2026',
    description: 'Tested and compared — find the right tool for your debate practice.',
  },
  {
    href: '/guides/how-to-practice-debate-online',
    category: 'guides',
    slug: 'how-to-practice-debate-online',
    title: 'How to Practice Debate Online',
    description: 'The complete 2026 guide — AI tools, communities, and solo drills.',
  },
];

/**
 * Shared layout for SEO landing pages (compare, tools, guides).
 * Renders markdown content with blog-consistent prose styling,
 * breadcrumb navigation, and a CTA footer.
 */
export default function SeoPageLayout({ page, backLink }: SeoPageLayoutProps) {
  // Filter out current page from related resources
  const relatedResources = ALL_RESOURCES.filter(
    (r) => !(r.category === page.category && r.slug === page.slug)
  );

  return (
    <div className="min-h-dvh flex flex-col">
      <Header />

      <main className="flex-1 px-5 py-8">
        <article className="max-w-3xl mx-auto">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              <li>
                <Link href="/" className="hover:text-[var(--accent)] transition-colors">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </li>
              <li>
                <Link href={backLink.href} className="hover:text-[var(--accent)] transition-colors">
                  {backLink.label}
                </Link>
              </li>
              <li aria-hidden="true">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </li>
              <li className="text-[var(--text-tertiary)] truncate max-w-[200px]">
                {page.title}
              </li>
            </ol>
          </nav>

          {/* Meta */}
          <header className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-serif font-semibold text-[var(--text)] mb-4 leading-tight">
              {page.title}
            </h1>

            <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-secondary)]">
              <span>{page.author}</span>
              <span className="w-1 h-1 rounded-full bg-[var(--border-strong)]" />
              <time dateTime={page.date}>
                {new Date(page.date).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </time>
              <span className="w-1 h-1 rounded-full bg-[var(--border-strong)]" />
              <span>{page.readingTime} min read</span>
            </div>
          </header>

          {/* Content */}
          <div
            className="blog-content prose dark:prose-invert max-w-none
              prose-headings:font-serif prose-headings:text-[var(--text)] prose-headings:font-semibold
              prose-h1:text-3xl prose-h1:sm:text-4xl prose-h1:leading-tight prose-h1:mb-6
              prose-h2:mt-12 prose-h2:mb-6 prose-h2:text-2xl prose-h2:sm:text-3xl prose-h2:leading-tight
              prose-h3:mt-10 prose-h3:mb-4 prose-h3:text-xl prose-h3:sm:text-2xl
              prose-p:text-[var(--text-secondary)] prose-p:leading-7 prose-p:my-6
              prose-a:text-[var(--accent)] prose-a:no-underline prose-a:font-medium hover:prose-a:underline
              prose-strong:text-[var(--text)] prose-strong:font-semibold
              prose-code:text-[var(--accent)] prose-code:bg-[var(--bg-sunken)] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
              prose-blockquote:border-l-2 prose-blockquote:border-[var(--accent)] prose-blockquote:pl-5 prose-blockquote:py-1 prose-blockquote:my-8 prose-blockquote:bg-[var(--bg-elevated)]/30 prose-blockquote:rounded-r-lg
              prose-blockquote:text-[var(--text)] prose-blockquote:not-italic prose-blockquote:text-lg prose-blockquote:font-medium
              prose-ul:my-6 prose-ol:my-6
              prose-li:text-[var(--text-secondary)] prose-li:my-2 prose-li:leading-relaxed
              prose-img:rounded-xl prose-img:my-8
              prose-table:my-8 prose-table:w-full
              prose-th:text-left prose-th:text-[var(--text)] prose-th:font-semibold prose-th:py-3 prose-th:px-4 prose-th:border-b prose-th:border-[var(--border)]
              prose-td:py-3 prose-td:px-4 prose-td:text-[var(--text-secondary)] prose-td:border-b prose-td:border-[var(--border)]/30
              prose-hr:my-10 prose-hr:border-[var(--border)]/50 prose-hr:border-t"
            dangerouslySetInnerHTML={{ __html: page.html }}
          />

          {/* Related content links */}
          {relatedResources.length > 0 && (
            <div className="mt-12 pt-8 border-t border-[var(--border)]/30">
              <h2 className="text-lg font-semibold text-[var(--text)] mb-4">
                More Resources
              </h2>
              <div className="space-y-3">
                {relatedResources.map((resource) => (
                  <Link
                    key={resource.href}
                    href={resource.href}
                    className="block p-4 rounded-xl bg-[var(--bg-elevated)]/50 border border-[var(--border)]/30 hover:border-[var(--accent)]/30 transition-all"
                  >
                    <h3 className="font-medium text-[var(--text)] text-sm mb-1">
                      {resource.title}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] line-clamp-1">
                      {resource.description}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="mt-8 p-6 rounded-xl bg-[var(--accent)]/5 border border-[var(--accent)]/20 text-center">
            <h3 className="text-lg font-semibold text-[var(--text)] mb-2">
              Ready to see AI debate in action?
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Watch AI models argue both sides of any topic — structured, adversarial, and free.
            </p>
            <Link
              href="/debate"
              className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium shadow-lg shadow-[var(--accent)]/25 hover:shadow-xl hover:shadow-[var(--accent)]/40 transition-all"
            >
              Start a Debate
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </article>
      </main>
    </div>
  );
}
