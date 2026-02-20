/**
 * GET  /api/admin/topics        — List all topics (optional ?category=... &enabledOnly=1)
 * POST /api/admin/topics        — Add a new topic
 */

import { NextRequest, NextResponse } from 'next/server';
import { listTopics, addTopic, getTopicCount } from '@/lib/daily-topics-db';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const category = searchParams.get('category') ?? undefined;
  const enabledOnly = searchParams.get('enabledOnly') === '1';
  const limit = parseInt(searchParams.get('limit') ?? '200', 10);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  const topics = await listTopics({ category, enabledOnly, limit, offset });
  const total = await getTopicCount();

  return NextResponse.json({ topics, total, limit, offset });
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    const { topic, persona, persona_id, category, weight } = body as {
      topic?: string;
      persona?: string;
      persona_id?: string;
      category?: string;
      weight?: number;
    };

    if (!topic || !persona || !category) {
      return NextResponse.json(
        { error: 'Missing required fields: topic, persona, category' },
        { status: 400 },
      );
    }

    const result = await addTopic({
      topic,
      persona,
      persona_id,
      category,
      weight: weight ?? 1.0,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Add topic error:', error);
    return NextResponse.json({ error: 'Failed to add topic' }, { status: 500 });
  }
}
