import type { MetadataRoute } from 'next';
import { d1 } from '@/lib/d1';
import { getAllPosts } from '@/lib/blog';
import { getAllPages } from '@/lib/pages';

// Force Node.js runtime for file system access
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Regenerate every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.debateai.org';

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/debate`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/explore`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/topics/history`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7,
    },
  ];

  // Dynamic debate pages from D1
  let debatePages: MetadataRoute.Sitemap = [];

  try {
    const result = await d1.query(
      'SELECT id, created_at FROM debates ORDER BY created_at DESC LIMIT 5000'
    );

    if (result.success && result.result) {
      debatePages = result.result.map((row) => ({
        url: `${baseUrl}/debate/${row.id as string}`,
        lastModified: row.created_at
          ? new Date(row.created_at as string)
          : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }));
    }
  } catch (error) {
    console.error('Sitemap: Failed to fetch debates from D1:', error);
    // Return static pages only if D1 fails — don't break the sitemap
  }

  // Blog posts
  let blogPages: MetadataRoute.Sitemap = [];

  try {
    const posts = getAllPosts();
    console.log(`Sitemap: Found ${posts.length} blog posts`);
    blogPages = posts.map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: new Date(post.date),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }));
  } catch (error) {
    console.error('Sitemap: Failed to load blog posts:', error);
    // Log additional debug info
    console.error('Sitemap: CWD:', process.cwd());
  }

  // SEO landing pages (compare, tools, guides)
  let seoPages: MetadataRoute.Sitemap = [];

  try {
    const pages = getAllPages();
    console.log(`Sitemap: Found ${pages.length} SEO pages`);
    seoPages = pages.map((page) => ({
      url: `${baseUrl}/${page.category}/${page.slug}`,
      lastModified: new Date(page.date),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    }));
  } catch (error) {
    console.error('Sitemap: Failed to load SEO pages:', error);
  }

  return [...staticPages, ...seoPages, ...blogPages, ...debatePages];
}
