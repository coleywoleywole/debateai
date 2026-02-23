import { notFound } from 'next/navigation';
import { TOPIC_CATEGORIES, getTopicWithCategory } from '@/lib/topics';
import { getCategoryById } from '@/lib/categories';
import { topicJsonLd } from '@/lib/jsonld';
import { d1 } from '@/lib/d1';
import Header from '@/components/Header';
import TopicPageClient from './TopicPageClient';

export default async function TopicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const result = getTopicWithCategory(slug);

  if (!result) {
    notFound();
  }

  const { topic: foundTopic, categoryId } = result;
  const topicData = {
    id: foundTopic.id,
    question: foundTopic.question,
    description: foundTopic.description,
    spicyLevel: foundTopic.spicyLevel,
    categoryId,
  };

  const category = getCategoryById(categoryId);

  // Fetch related community debates from D1
  let communityDebates: Array<{
    id: string;
    topic: string;
    opponent: string;
    created_at: string;
  }> = [];

  try {
    const result = await d1.query(
      `SELECT id, topic, opponent, created_at FROM debates
       WHERE topic LIKE ? AND user_id != 'test-user-123'
       ORDER BY created_at DESC LIMIT 10`,
      [`%${topicData.question.slice(0, 50)}%`]
    );
    if (result.success && result.result) {
      communityDebates = result.result as any[];
    }
  } catch {
    // D1 unavailable — proceed without community debates
  }

  // Get related topics from same category
  const currentCategory = TOPIC_CATEGORIES.find((c) => c.id === topicData!.categoryId);
  const relatedTopics = currentCategory
    ? currentCategory.topics
        .filter((t) => t.id !== topicData!.id)
        .slice(0, 6)
    : [];

  // Persona pairings for this topic
  const personas = [
    { name: "Devil's Advocate", style: "Contrarian who challenges every assumption" },
    { name: 'Socrates', style: 'Asks probing questions to uncover flaws in reasoning' },
    { name: 'Academic Professor', style: 'Cites research and builds structured arguments' },
    { name: 'Street Debater', style: 'Passionate, real-world examples, pulls no punches' },
  ];

  return (
    <>
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            topicJsonLd({
              slug: topicData.id,
              question: topicData.question,
              category: topicData.categoryId,
              categoryName: category?.name || 'General',
              debateCount: communityDebates.length,
              description: topicData.description,
            })
          ),
        }}
      />

      <div className="min-h-dvh flex flex-col">
        <Header />
        <TopicPageClient
          topic={topicData}
          category={category || { id: 'general', name: 'General', emoji: '💡', description: '', aliases: [] }}
          communityDebates={communityDebates}
          relatedTopics={relatedTopics}
          personas={personas}
        />
      </div>
    </>
  );
}
