/**
 * POST /api/admin/topics/seed
 *
 * Creates the daily_topics + daily_topic_history tables and seeds
 * the topic pool from the curated list. Idempotent — safe to call
 * multiple times (uses INSERT OR IGNORE).
 */

import { NextResponse } from 'next/server';
import { createTopicTables, addTopic, getTopicCount } from '@/lib/daily-topics-db';
import { CURATED_DAILY_DEBATES } from '@/lib/daily-debates';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Create tables
    await createTopicTables();

    // 2. Check existing count
    const existingCount = await getTopicCount();

    if (existingCount >= CURATED_DAILY_DEBATES.length) {
      return NextResponse.json({
        message: 'Topics already seeded',
        count: existingCount,
      });
    }

    // 3. Seed topics from curated list
    let added = 0;
    let skipped = 0;

    for (const debate of CURATED_DAILY_DEBATES) {
      const id = debate.topicId
        ? `${debate.category}-${debate.topicId}`
        : `${debate.category}-${debate.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}`;

      try {
        await addTopic({
          id,
          topic: debate.topic,
          persona: debate.persona,
          persona_id: debate.personaId ?? undefined,
          category: debate.category ?? 'general',
          weight: 1.0,
        });
        added++;
      } catch {
        // Likely duplicate ID — skip
        skipped++;
      }
    }

    const totalCount = await getTopicCount();

    return NextResponse.json({
      message: 'Topics seeded successfully',
      added,
      skipped,
      total: totalCount,
    });
  } catch (error) {
    console.error('Seed topics error:', error);
    return NextResponse.json(
      { error: 'Failed to seed topics' },
      { status: 500 },
    );
  }
}
