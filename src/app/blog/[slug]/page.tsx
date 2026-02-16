import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getPostBySlug, getAllPosts } from '@/lib/blog';
import { articleJsonLd } from '@/lib/jsonld';
import Header from '@/components/Header';
import AnalyticsPageView from '@/components/AnalyticsPageView';

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const relatedPosts = getAllPosts()
    .filter((p) => p.slug !== slug)
    .filter((p) => p.tags.some((t) => post.tags.includes(t)))
    .slice(0, 3);

  return (
    <>
      {/* Analytics */}
      <AnalyticsPageView
        type="blog_post"
        slug={post.slug}
        title={post.title}
        tags={post.tags}
        readingTime={post.readingTime}
      />

      {/* JSON-LD Article structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            articleJsonLd({
              slug: post.slug,
              title: post.title,
              description: post.description,
              date: post.date,
              author: post.author,
              tags: post.tags,
              image: post.image,
            })
          ),
        }}
      />

      <div className="min-h-dvh flex flex-col">
        <Header />

        <main className="flex-1 px-5 py-8">
          <article className="max-w-3xl mx-auto">
            {/* Back link */}
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors mb-6"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Blog
            </Link>

            {/* Header */}
            <header className="mb-8">
              {/* Tags */}
              {post.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <h1 className="text-3xl sm:text-4xl font-serif font-semibold text-[var(--text)] mb-4 leading-tight">
                {post.title}
              </h1>

              <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-secondary)]">
                <span>{post.author}</span>
                <span className="w-1 h-1 rounded-full bg-[var(--border-strong)]" />
                <time dateTime={post.date}>
                  {new Date(post.date).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </time>
                <span className="w-1 h-1 rounded-full bg-[var(--border-strong)]" />
                <span>{post.readingTime} min read</span>
              </div>
            </header>

            {/* Hero Image */}
            {post.image && (
              <div className="mb-8 -mx-5 sm:mx-0 relative aspect-[2/1]">
                <Image 
                  src={post.image} 
                  alt={post.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 768px"
                  className="object-cover rounded-none sm:rounded-xl"
                  priority
                />
              </div>
            )}

            {/* Content */}
            <div
              className="blog-content prose prose-lg dark:prose-invert max-w-none
                prose-headings:font-serif prose-headings:text-[var(--text)] prose-headings:font-semibold
                prose-h2:mt-12 prose-h2:mb-6 prose-h2:pb-3 prose-h2:border-b prose-h2:border-[var(--border)]/50 prose-h2:text-2xl prose-h2:sm:text-3xl prose-h2:leading-tight
                prose-h3:mt-10 prose-h3:mb-4 prose-h3:text-xl prose-h3:sm:text-2xl
                prose-p:text-[var(--text)] prose-p:opacity-90 prose-p:leading-relaxed prose-p:my-6
                prose-a:text-[var(--accent)] prose-a:no-underline prose-a:font-medium hover:prose-a:underline
                prose-strong:text-[var(--text)] prose-strong:font-bold
                prose-code:text-[var(--accent)] prose-code:bg-[var(--bg-sunken)] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
                prose-blockquote:border-l-4 prose-blockquote:border-[var(--accent)] prose-blockquote:pl-6 prose-blockquote:py-3 prose-blockquote:my-10 prose-blockquote:bg-[var(--bg-elevated)] prose-blockquote:shadow-md prose-blockquote:rounded-r-xl
                prose-blockquote:text-[var(--text)] prose-blockquote:not-italic prose-blockquote:text-lg prose-blockquote:sm:text-xl prose-blockquote:font-medium
                prose-ul:my-8 prose-ol:my-8 prose-li:my-3
                prose-li:text-[var(--text)] prose-li:opacity-90 prose-li:leading-relaxed
                prose-img:rounded-2xl prose-img:my-10 prose-img:shadow-xl
                prose-hr:my-12 prose-hr:border-[var(--border)]/50 prose-hr:border-t"
              dangerouslySetInnerHTML={{ __html: post.html }}
            />

            {/* Related Posts */}
            {relatedPosts.length > 0 && (
              <div className="mt-12 pt-8 border-t border-[var(--border)]/30 text-left">
                <h2 className="text-lg font-semibold text-[var(--text)] mb-6">
                  Related Posts
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {relatedPosts.map((related) => (
                    <Link
                      key={related.slug}
                      href={`/blog/${related.slug}`}
                      className="group artistic-card p-0 overflow-hidden hover:border-[var(--accent)]/30 transition-all flex flex-col"
                    >
                      {related.image && (
                        <div className="aspect-[2/1] relative overflow-hidden bg-[var(--bg-sunken)]">
                          <Image
                            src={related.image}
                            alt={related.title}
                            fill
                            sizes="(max-width: 768px) 100vw, 33vw"
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                      )}
                      <div className="p-4 flex-1">
                        <h3 className="font-semibold text-[var(--text)] text-sm mb-1 group-hover:text-[var(--accent)] transition-colors line-clamp-2 leading-snug">
                          {related.title}
                        </h3>
                        <p className="text-xs text-[var(--text-secondary)] line-clamp-2 opacity-80">
                          {related.description}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="mt-12 p-6 rounded-xl bg-[var(--accent)]/5 border border-[var(--accent)]/20 text-center">
              <h3 className="text-lg font-semibold text-[var(--text)] mb-2">
                Ready to test your arguments?
              </h3>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                Challenge AI opponents trained in every debate style.
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium shadow-lg shadow-[var(--accent)]/25 hover:shadow-xl hover:shadow-[var(--accent)]/40 transition-all"
              >
                Start a Debate
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </Link>
            </div>
          </article>
        </main>
      </div>
    </>
  );
}
