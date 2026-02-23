import { NextResponse } from 'next/server';
import { createRateLimiter, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import { withErrorHandler } from '@/lib/api-errors';
import { TOPIC_CATEGORIES, type Topic } from '@/lib/topics';
import { listTopics, type DailyTopic } from '@/lib/daily-topics-db';
import { CATEGORIES, resolveCategory, getCategoryEmoji } from '@/lib/categories';

// 20 requests per minute per IP
const limiter = createRateLimiter({ maxRequests: 20, windowMs: 60_000 });

// Cache for 10 minutes
let browseCache: { data: BrowseResponse; timestamp: number } | null = null;
const CACHE_TTL = 10 * 60 * 1000;

interface BrowseTopic {
  id: string;
  question: string;
  category: string;
  categoryEmoji: string;
  spicyLevel?: number;
  persona?: string;
  source: 'curated' | 'daily';
}

interface BrowseCategory {
  id: string;
  name: string;
  emoji: string;
  description: string;
  topics: BrowseTopic[];
}

interface BrowseResponse {
  categories: BrowseCategory[];
  totalTopics: number;
  generatedAt: string;
}

/**
 * GET /api/topics/browse
 *
 * Returns all browsable topics grouped by category.
 * Merges curated topics from topics.ts with D1 daily_topics, deduplicates.
 */
export const GET = withErrorHandler(async (request: Request) => {
  const rl = limiter.check(getClientIp(request));
  if (!rl.allowed) {
    return rateLimitResponse(rl) as unknown as NextResponse;
  }

  // Return cache if fresh
  if (browseCache && Date.now() - browseCache.timestamp < CACHE_TTL) {
    return NextResponse.json({ ...browseCache.data, cached: true }, {
      headers: {
        'Cache-Control': 'public, max-age=600, s-maxage=600',
        ...rl.headers,
      },
    });
  }

  // 1. Gather curated topics from topics.ts
  const curatedTopics: BrowseTopic[] = [];
  for (const cat of TOPIC_CATEGORIES) {
    const categoryId = resolveCategory(cat.id);
    const emoji = getCategoryEmoji(categoryId);
    for (const topic of cat.topics) {
      curatedTopics.push({
        id: topic.id,
        question: topic.question,
        category: categoryId,
        categoryEmoji: emoji,
        spicyLevel: topic.spicyLevel,
        source: 'curated',
      });
    }
  }

  // 2. Gather daily topics from D1 (if available)
  let dailyTopics: DailyTopic[] = [];
  try {
    dailyTopics = await listTopics({ enabledOnly: true, limit: 500 });
  } catch {
    // D1 unavailable — proceed with curated only
  }

  const dailyBrowseTopics: BrowseTopic[] = dailyTopics.map((dt) => {
    const categoryId = resolveCategory(dt.category);
    return {
      id: dt.id,
      question: dt.topic,
      category: categoryId,
      categoryEmoji: getCategoryEmoji(categoryId),
      persona: dt.persona,
      source: 'daily' as const,
    };
  });

  // 3. Merge and deduplicate (by question text, case-insensitive)
  const seen = new Set<string>();
  const allTopics: BrowseTopic[] = [];

  // Curated first (they take precedence)
  for (const t of curatedTopics) {
    const key = t.question.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      allTopics.push(t);
    }
  }
  for (const t of dailyBrowseTopics) {
    const key = t.question.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      allTopics.push(t);
    }
  }

  // 4. Group by category
  const categoryMap = new Map<string, BrowseTopic[]>();
  for (const t of allTopics) {
    const list = categoryMap.get(t.category) || [];
    list.push(t);
    categoryMap.set(t.category, list);
  }

  // 5. Build response ordered by CATEGORIES
  const categories: BrowseCategory[] = [];
  for (const cat of CATEGORIES) {
    const topics = categoryMap.get(cat.id) || [];
    if (topics.length > 0) {
      categories.push({
        id: cat.id,
        name: cat.name,
        emoji: cat.emoji,
        description: cat.description,
        topics,
      });
    }
  }

  const data: BrowseResponse = {
    categories,
    totalTopics: allTopics.length,
    generatedAt: new Date().toISOString(),
  };

  browseCache = { data, timestamp: Date.now() };

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, max-age=600, s-maxage=600',
      ...rl.headers,
    },
  });
});
