import { getCurrentDailyTopic } from '@/lib/daily-topics-db';
import { getDailyDebate, CURATED_DAILY_DEBATES } from '@/lib/daily-debates';
import HomeClient from './HomeClient';

export const runtime = 'nodejs';
export const revalidate = 300; // Re-fetch every 5 minutes (ISR)

/**
 * Landing page — server component.
 *
 * Fetches today's daily topic from D1 (if available).
 * Falls back to the local deterministic rotation if D1
 * is not configured or the topic pool hasn't been seeded.
 */
export default async function Home() {
  let dailyDebate: { topic: string; persona: string; personaId?: string | null; category?: string };

  try {
    const dbTopic = await getCurrentDailyTopic();

    if (dbTopic) {
      dailyDebate = {
        topic: dbTopic.topic,
        persona: dbTopic.persona,
        personaId: dbTopic.persona_id,
        category: dbTopic.category,
      };
    } else {
      // D1 not configured or pool not seeded — fall back to local
      const local = getDailyDebate();
      dailyDebate = {
        topic: local.topic,
        persona: local.persona,
        personaId: local.personaId,
        category: local.category,
      };
    }
  } catch {
    // D1 error — graceful fallback
    const local = getDailyDebate();
    dailyDebate = {
      topic: local.topic,
      persona: local.persona,
      personaId: local.personaId,
      category: local.category,
    };
  }

  // Pick 3 random "Or try" suggestions from the curated pool, excluding today's topic
  const otherTopics = CURATED_DAILY_DEBATES.filter(d => d.topic !== dailyDebate.topic);
  const shuffled = otherTopics.sort(() => Math.random() - 0.5);
  const quickStarts = shuffled.slice(0, 3).map(d => ({
    topic: d.topic,
    persona: d.persona,
    personaId: d.personaId,
    category: d.category,
  }));

  return <HomeClient initialDebate={dailyDebate} quickStarts={quickStarts} />;
}
