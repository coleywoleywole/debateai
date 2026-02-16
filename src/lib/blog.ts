import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

export interface BlogPostMeta {
  slug: string;
  title: string;
  description: string;
  date: string; // ISO date string
  author: string;
  tags: string[];
  image?: string; // OG image path or URL
  published: boolean;
}

export interface BlogPost extends BlogPostMeta {
  content: string; // Raw markdown
  html: string; // Rendered HTML
  readingTime: number; // Minutes
}

/**
 * Get all published blog posts, sorted by date (newest first).
 */
export function getAllPosts(): BlogPostMeta[] {
  if (!fs.existsSync(BLOG_DIR)) {
    return [];
  }

  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md'));

  const posts = files
    .map((filename) => {
      const slug = filename.replace(/\.md$/, '');
      const filePath = path.join(BLOG_DIR, filename);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const { data } = matter(fileContent);

      return {
        slug,
        title: (data.title as string) || slug,
        description: (data.description as string) || '',
        date: (data.date as string) || new Date().toISOString(),
        author: (data.author as string) || 'DebateAI Team',
        tags: Array.isArray(data.tags) ? data.tags : [],
        image: data.image as string | undefined,
        published: data.published !== false && data.status !== 'draft', // Respect status: draft
      } satisfies BlogPostMeta;
    })
    .filter((post) => {
      const isPublished = post.published && !post.slug.startsWith('_');
      const isNotFuture = new Date(post.date).getTime() <= Date.now();
      return isPublished && isNotFuture;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return posts;
}

/**
 * Get all post slugs for static generation.
 */
export function getAllSlugs(): string[] {
  return getAllPosts().map((post) => post.slug);
}

/**
 * Get a single blog post by slug, with rendered HTML.
 */
export function getPostBySlug(slug: string): BlogPost | null {
  const filePath = path.join(BLOG_DIR, `${slug}.md`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(fileContent);

  if (data.published === false || data.status === 'draft') {
    return null;
  }

  // Configure marked for safe rendering
  marked.setOptions({
    gfm: true,
    breaks: true,
  });

  // Strip the first H1 if it exists (the page provides its own H1)
  const contentWithoutH1 = content.replace(/^#\s+.+\n?/, "");
  const html = marked.parse(contentWithoutH1) as string;
  const readingTime = Math.max(1, Math.ceil(content.split(/\s+/).length / 200));

  return {
    slug,
    title: (data.title as string) || slug,
    description: (data.description as string) || '',
    date: (data.date as string) || new Date().toISOString(),
    author: (data.author as string) || 'DebateAI Team',
    tags: Array.isArray(data.tags) ? data.tags : [],
    image: data.image as string | undefined,
    published: true,
    content,
    html,
    readingTime,
  };
}
