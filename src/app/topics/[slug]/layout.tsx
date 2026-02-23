import type { Metadata } from 'next';
import { TOPIC_CATEGORIES, getTopicWithCategory } from '@/lib/topics';
import { getCategoryById } from '@/lib/categories';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://debateai.org';

// Generate static params for all curated topics at build time
export async function generateStaticParams() {
  return TOPIC_CATEGORIES.flatMap((cat) =>
    cat.topics.map((topic) => ({ slug: topic.id }))
  );
}

// Dynamic metadata per topic
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const result = getTopicWithCategory(slug);

  if (!result) {
    return {
      title: 'Topic Not Found — DebateAI',
      description: 'The debate topic you are looking for does not exist.',
    };
  }

  const { topic: topicData, categoryId } = result;
  const category = getCategoryById(categoryId);
  const topicUrl = `${BASE_URL}/topics/${slug}`;
  const ogImage = `${BASE_URL}/api/og`;

  const title = `${topicData.question} — Debate on DebateAI`;
  const description =
    topicData.description ||
    `Debate "${topicData.question}" with AI opponents on DebateAI. Challenge your thinking in the ${category?.name || 'General'} category.`;

  return {
    title,
    description,
    alternates: {
      canonical: topicUrl,
    },
    openGraph: {
      title,
      description,
      url: topicUrl,
      type: 'article',
      siteName: 'DebateAI',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: topicData.question,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

export default function TopicSlugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
