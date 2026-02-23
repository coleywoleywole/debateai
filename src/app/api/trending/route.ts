import { NextResponse } from 'next/server';
import { createRateLimiter, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import { withErrorHandler } from '@/lib/api-errors';
import { getGeminiModel } from '@/lib/vertex';

// 10 requests per minute per IP (calls external APIs when cache is cold)
const limiter = createRateLimiter({ maxRequests: 10, windowMs: 60_000 });

// Cache trending topics for 1 hour
let cachedTopics: TrendingTopic[] | null = null;
let cacheTime: number = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

export interface TrendingTopic {
  id: string;
  question: string;
  context: string;
  source: string;
  category: 'politics' | 'tech' | 'culture' | 'business' | 'science' | 'sports';
  heat: 1 | 2 | 3; // How hot/controversial
}

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

async function fetchTrendingNews(): Promise<TavilyResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn('[trending] No TAVILY_API_KEY configured');
    return [];
  }

  const queries = [
    'controversial debate topics today 2026',
    'viral social media argument this week',
    'polarizing news stories today',
  ];

  const allResults: TavilyResult[] = [];

  for (const query of queries.slice(0, 2)) {
    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          search_depth: 'basic',
          include_answer: false,
          max_results: 5,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.results) {
          allResults.push(
            ...data.results.map((r: TavilyResult) => ({
              title: r.title,
              url: r.url,
              content: r.content,
              score: r.score,
            }))
          );
        }
      }
    } catch (e) {
      console.error('[trending] Tavily search error:', e);
    }
  }

  return allResults;
}

async function convertToDebateTopics(results: TavilyResult[]): Promise<TrendingTopic[]> {
  if (results.length === 0) return [];

  const newsText = results
    .slice(0, 10)
    .map((r, i) => `${i + 1}. "${r.title}" — ${r.content?.slice(0, 200) || ''}`)
    .join('\n');

  try {
    const model = getGeminiModel('gemini-2.5-flash', {
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const prompt = `Convert these news stories into 5-6 provocative debate questions. Each should be a yes/no or "which side" question that people would actually argue about.

NEWS:
${newsText}

Return JSON array with this format (no markdown, just raw JSON):
[
  {
    "id": "unique-slug",
    "question": "Should X do Y?",
    "context": "Brief context from the news (1 sentence)",
    "source": "source name",
    "category": "politics|tech|culture|business|science|sports",
    "heat": 1-3 (how controversial)
  }
]

Make questions punchy and debatable. Avoid boring policy questions. Go for takes people actually argue about.`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const response = await result.response;
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let jsonText = text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText
        .replace(/```json?\n?/g, '')
        .replace(/```$/g, '')
        .trim();
    }

    const topics = JSON.parse(jsonText) as TrendingTopic[];
    return topics.filter((t) => t.question && t.id);
  } catch (e) {
    console.error('[trending] Gemini conversion error:', e);
    return [];
  }
}

function getFallbackTopics(): TrendingTopic[] {
  return [
    {
      id: 'ai-taking-jobs',
      question: 'Is AI actually coming for your job this year?',
      context: 'Tech layoffs continue while AI tools proliferate',
      source: 'Tech News',
      category: 'tech',
      heat: 3,
    },
    {
      id: 'social-media-teens',
      question: 'Should kids under 16 be banned from social media?',
      context: 'Multiple states considering age restrictions',
      source: 'Politics',
      category: 'culture',
      heat: 2,
    },
    {
      id: 'remote-work-over',
      question: 'Is remote work actually dying?',
      context: 'Return-to-office mandates spreading across industries',
      source: 'Business',
      category: 'business',
      heat: 2,
    },
    {
      id: 'tipping-out-of-control',
      question: 'Has tipping culture gone too far?',
      context: 'Tip prompts now appearing everywhere from self-checkout to takeout',
      source: 'Culture',
      category: 'culture',
      heat: 2,
    },
    {
      id: 'college-worth-it',
      question: 'Is a college degree still worth the debt?',
      context: 'Student loan debates continue as tuition rises',
      source: 'Education',
      category: 'culture',
      heat: 2,
    },
  ];
}

export const GET = withErrorHandler(async (request: Request) => {
  const rl = limiter.check(getClientIp(request));
  if (!rl.allowed) {
    return rateLimitResponse(rl) as unknown as NextResponse;
  }

  // Check cache
  if (cachedTopics && Date.now() - cacheTime < CACHE_DURATION) {
    return NextResponse.json({
      topics: cachedTopics,
      cached: true,
      cacheAge: Math.floor((Date.now() - cacheTime) / 1000 / 60) + ' minutes',
    });
  }

  // Fetch news via Tavily
  const results = await fetchTrendingNews();

  if (results.length === 0) {
    return NextResponse.json({
      topics: getFallbackTopics(),
      cached: false,
      fallback: true,
    });
  }

  // Convert to debate topics via Gemini
  const topics = await convertToDebateTopics(results);

  if (topics.length > 0) {
    cachedTopics = topics;
    cacheTime = Date.now();

    return NextResponse.json({ topics, cached: false });
  } else {
    return NextResponse.json({
      topics: getFallbackTopics(),
      cached: false,
      fallback: true,
    });
  }
});
