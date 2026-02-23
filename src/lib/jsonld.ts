// JSON-LD structured data generators for SEO

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://debateai.org';

/**
 * WebSite schema for the root layout.
 * Helps Google understand the site identity.
 */
export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'DebateAI',
    url: BASE_URL,
    description:
      'Challenge your beliefs against AI trained to argue from every perspective. Sharpen your critical thinking through rigorous intellectual debate.',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/debate`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * DiscussionForumPosting schema for individual debate pages.
 * Makes debate content eligible for rich results.
 */
export function debateJsonLd(debate: {
  id: string;
  topic: string;
  opponentName: string;
  messages: Array<{ role: string; content: string }>;
  createdAt?: string;
}) {
  const debateUrl = `${BASE_URL}/debate/${debate.id}`;

  // Build comment list from the debate messages (up to 20)
  const comments = debate.messages
    .filter((m) => m.role && m.content)
    .slice(0, 20)
    .map((msg, i) => ({
      '@type': 'Comment',
      position: i + 1,
      author: {
        '@type': msg.role === 'user' ? 'Person' : 'Organization',
        name: msg.role === 'user' ? 'Debater' : debate.opponentName,
      },
      text:
        msg.content.length > 500
          ? msg.content.slice(0, 497) + '...'
          : msg.content,
    }));

  return {
    '@context': 'https://schema.org',
    '@type': 'DiscussionForumPosting',
    headline: debate.topic,
    url: debateUrl,
    author: {
      '@type': 'Person',
      name: 'Debater',
    },
    datePublished: debate.createdAt || new Date().toISOString(),
    discussionUrl: debateUrl,
    interactionStatistic: [
      {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/CommentAction',
        userInteractionCount: debate.messages.length,
      },
    ],
    comment: comments.length > 0 ? comments : undefined,
    isPartOf: {
      '@type': 'WebSite',
      name: 'DebateAI',
      url: BASE_URL,
    },
  };
}

/**
 * DiscussionForumPosting schema for topic pages.
 * Makes topic pages eligible for rich results.
 */
export function topicJsonLd(topic: {
  slug: string;
  question: string;
  category: string;
  categoryName: string;
  debateCount?: number;
  description?: string;
}) {
  const topicUrl = `${BASE_URL}/topics/${topic.slug}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'DiscussionForumPosting',
    headline: topic.question,
    url: topicUrl,
    about: {
      '@type': 'Thing',
      name: topic.categoryName,
    },
    description:
      topic.description ||
      `Debate the topic "${topic.question}" with AI on DebateAI. Challenge your thinking and sharpen your arguments.`,
    interactionStatistic: topic.debateCount
      ? [
          {
            '@type': 'InteractionCounter',
            interactionType: 'https://schema.org/CommentAction',
            userInteractionCount: topic.debateCount,
          },
        ]
      : undefined,
    isPartOf: {
      '@type': 'WebSite',
      name: 'DebateAI',
      url: BASE_URL,
    },
  };
}

/**
 * Article schema for blog posts and SEO pages.
 * Enables rich results for articles in Google Search.
 *
 * @param post.slug - For blog posts use the slug (e.g. "my-post").
 *   For SEO pages pass the full path segment (e.g. "compare/debateai-vs-chatgpt").
 * @param post.basePath - Optional base path. Defaults to "/blog".
 */
export function articleJsonLd(post: {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  tags: string[];
  image?: string;
  basePath?: string;
}) {
  const base = post.basePath ?? '/blog';
  const postUrl = `${BASE_URL}${base}/${post.slug}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    url: postUrl,
    datePublished: post.date,
    dateModified: post.date,
    author: {
      '@type': 'Person',
      name: post.author,
    },
    publisher: {
      '@type': 'Organization',
      name: 'DebateAI',
      url: BASE_URL,
    },
    image: post.image || `${BASE_URL}/api/og`,
    keywords: post.tags.join(', '),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': postUrl,
    },
    isPartOf: {
      '@type': 'WebSite',
      name: 'DebateAI',
      url: BASE_URL,
    },
  };
}
