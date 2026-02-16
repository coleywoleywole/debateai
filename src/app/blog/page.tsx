import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { getAllPosts, getPostBySlug } from '@/lib/blog';
import Header from '@/components/Header';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.debateai.org';

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Insights on AI debate, critical thinking, and the art of argumentation. Tips, strategies, and deep dives from the DebateAI team.',
  alternates: {
    canonical: `${BASE_URL}/blog`,
  },
  openGraph: {
    title: 'DebateAI Blog',
    description: 'Insights on AI debate, critical thinking, and the art of argumentation.',
    url: `${BASE_URL}/blog`,
    type: 'website',
  },
};

export default function BlogIndex() {
  const posts = getAllPosts().map(meta => {
    const fullPost = getPostBySlug(meta.slug);
    return {
      ...meta,
      readingTime: fullPost?.readingTime || 1
    };
  });

  return (
    <div className="min-h-dvh flex flex-col">
      <Header />

      <main className="flex-1 px-5 py-8 sm:py-12">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="h-px w-8 bg-gradient-to-r from-transparent to-[var(--accent)] opacity-50" />
              <span className="text-[11px] font-semibold text-[var(--accent)] uppercase tracking-[0.2em]">
                Blog
              </span>
              <span className="h-px w-8 bg-gradient-to-l from-transparent to-[var(--accent)] opacity-50" />
            </div>            <h1 className="text-4xl sm:text-5xl font-serif font-semibold text-[var(--text)] mb-4 leading-tight">
              Insights & Ideas
            </h1>
            <p className="text-base sm:text-lg text-[var(--text-secondary)] max-w-xl mx-auto leading-relaxed">
              Strategies, deep dives, and perspectives on AI debate and critical thinking.
            </p>
          </div>

          {/* Posts Grid */}
          {posts.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border)]/30 flex items-center justify-center">
                <svg className="w-10 h-10 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-[var(--text)] mb-2">
                Coming soon
              </h3>
              <p className="text-[var(--text-secondary)] max-w-sm mx-auto mb-8">
                We&apos;re working on our first posts. Check back soon for insights on AI debate and critical thinking.
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
              >
                Start a Debate
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                </svg>
              </Link>
            </div>
          ) : (
            <div className="grid gap-6 sm:gap-8">
              {/* Featured Post (first post) */}
              {posts.length > 0 && (
                <Link
                  href={`/blog/${posts[0].slug}`}
                  className="group block animate-fade-up"
                >
                  <article className="relative">
                    <div className="absolute -inset-1 bg-gradient-to-r from-[var(--accent)]/0 to-[var(--accent)]/0 group-hover:from-[var(--accent)]/10 group-hover:to-[var(--accent-light)]/10 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-all duration-300" />
                    <div className="relative artistic-card p-6 sm:p-8 hover:border-[var(--accent)]/30 transition-all duration-300">
                      <div className="flex flex-col sm:flex-row gap-6">
                        {/* Hero Image */}
                        <div className="sm:w-1/3 aspect-[16/10] rounded-xl bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent-light)]/10 overflow-hidden shrink-0 relative">
                          {posts[0].image ? (
                            <Image 
                              src={posts[0].image} 
                              alt={posts[0].title}
                              fill
                              sizes="(max-width: 640px) 100vw, 33vw"
                              className="object-cover"
                              priority
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <svg className="w-12 h-12 text-[var(--accent)]/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                              </svg>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 flex flex-col justify-center">
                          {/* Tags */}
                          {posts[0].tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                              {posts[0].tags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  className="text-[10px] px-2.5 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-semibold"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          <h2 className="text-2xl sm:text-3xl font-serif font-semibold text-[var(--text)] mb-3 group-hover:text-[var(--accent)] transition-colors leading-tight">
                            {posts[0].title}
                          </h2>
                          <p className="text-[var(--text-secondary)] leading-relaxed mb-4 line-clamp-3">
                            {posts[0].description}
                          </p>

                          <div className="flex items-center gap-3 text-sm text-[var(--text-tertiary)]">
                            <span className="font-medium text-[var(--text-secondary)]">{posts[0].author}</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--border-strong)]" />
                            <time dateTime={posts[0].date}>
                              {new Date(posts[0].date).toLocaleDateString('en-US', {
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </time>
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--border-strong)]" />
                            <span>{posts[0].readingTime} min read</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                </Link>
              )}

              {/* Remaining Posts Grid */}
              {posts.length > 1 && (
                <div className="grid sm:grid-cols-2 gap-6 sm:gap-8">
                  {posts.slice(1).map((post, index) => (
                    <Link
                      key={post.slug}
                      href={`/blog/${post.slug}`}
                      className="group block animate-fade-up"
                      style={{ animationDelay: `${(index + 1) * 100}ms` }}
                    >
                      <article className="relative h-full">
                        <div className="absolute -inset-1 bg-gradient-to-r from-[var(--accent)]/0 to-[var(--accent)]/0 group-hover:from-[var(--accent)]/10 group-hover:to-[var(--accent-light)]/10 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-all duration-300" />
                        <div className="relative artistic-card p-0 hover:border-[var(--accent)]/30 transition-all duration-300 h-full flex flex-col overflow-hidden">
                          {/* Card Image */}
                          <div className="aspect-[2/1] relative overflow-hidden bg-gradient-to-br from-[var(--accent)]/10 to-[var(--accent-light)]/5">
                            {post.image ? (
                              <Image 
                                src={post.image} 
                                alt={post.title}
                                fill
                                sizes="(max-width: 640px) 100vw, 50vw"
                                className="object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center opacity-30">
                                <svg className="w-10 h-10 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                                </svg>
                              </div>
                            )}
                          </div>

                          <div className="p-6 flex-1 flex flex-col">
                            {/* Tags */}
                            {post.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mb-3">
                                {post.tags.slice(0, 2).map((tag) => (
                                  <span
                                    key={tag}
                                    className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-medium uppercase tracking-wider"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}

                            <h2 className="text-xl font-semibold text-[var(--text)] mb-2 group-hover:text-[var(--accent)] transition-colors leading-snug">
                              {post.title}
                            </h2>
                            <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-4 flex-1">
                              {post.description}
                            </p>

                            <div className="flex items-center gap-2 text-[10px] text-[var(--text-tertiary)] pt-4 border-t border-[var(--border)]/30 uppercase font-medium tracking-wide">
                              <span>{post.author}</span>
                              <span className="w-1 h-1 rounded-full bg-[var(--border-strong)]" />
                              <time dateTime={post.date}>
                                {new Date(post.date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </time>
                              <span className="w-1 h-1 rounded-full bg-[var(--border-strong)]" />
                              <span>{post.readingTime} min read</span>
                            </div>
                          </div>
                        </div>
                      </article>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Guides & Resources */}
          <div className="mt-16 pt-12 border-t border-[var(--border)]/30">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 mb-3">
                <span className="h-px w-8 bg-gradient-to-r from-transparent to-[var(--accent)] opacity-50" />
                <span className="text-[11px] font-semibold text-[var(--accent)] uppercase tracking-[0.2em]">
                  Guides & Resources
                </span>
                <span className="h-px w-8 bg-gradient-to-l from-transparent to-[var(--accent)] opacity-50" />
              </div>
              <p className="text-sm text-[var(--text-secondary)] max-w-lg mx-auto">
                In-depth guides on AI debate tools, practice methods, and getting the most out of DebateAI.
              </p>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <Link
                href="/compare/debateai-vs-chatgpt"
                className="group artistic-card p-5 hover:border-[var(--accent)]/30 transition-all"
              >
                <div className="text-lg mb-2">⚔️</div>
                <h3 className="text-sm font-semibold text-[var(--text)] mb-1 group-hover:text-[var(--accent)] transition-colors">
                  DebateAI vs ChatGPT
                </h3>
                <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                  Purpose-built debate tool vs general AI — which is better for practice?
                </p>
              </Link>
              <Link
                href="/tools/best-ai-debate-tools-2026"
                className="group artistic-card p-5 hover:border-[var(--accent)]/30 transition-all"
              >
                <div className="text-lg mb-2">🛠️</div>
                <h3 className="text-sm font-semibold text-[var(--text)] mb-1 group-hover:text-[var(--accent)] transition-colors">
                  Best AI Debate Tools 2026
                </h3>
                <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                  7 tools tested and compared — find the right one for your needs.
                </p>
              </Link>
              <Link
                href="/guides/how-to-practice-debate-online"
                className="group artistic-card p-5 hover:border-[var(--accent)]/30 transition-all"
              >
                <div className="text-lg mb-2">📖</div>
                <h3 className="text-sm font-semibold text-[var(--text)] mb-1 group-hover:text-[var(--accent)] transition-colors">
                  How to Practice Debate Online
                </h3>
                <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                  The complete guide — AI tools, communities, and solo drills.
                </p>
              </Link>
            </div>
          </div>

          {/* Footer Links */}
          <div className="mt-16 flex items-center justify-center gap-6 text-sm text-[var(--text-secondary)]">
            <Link href="/" className="hover:text-[var(--text)] transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
              </svg>
              Home
            </Link>
            <span className="w-1 h-1 rounded-full bg-[var(--border-strong)]" />
            <Link href="/debate" className="hover:text-[var(--text)] transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"/>
              </svg>
              Start a Debate
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
