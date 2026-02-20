/**
 * GET    /api/admin/topics/:id  — Get single topic
 * PATCH  /api/admin/topics/:id  — Update topic fields
 * DELETE /api/admin/topics/:id  — Delete topic
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTopic, updateTopic, deleteTopic } from '@/lib/daily-topics-db';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const secret = _request.headers.get('authorization')?.replace('Bearer ', '');
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const topic = await getTopic(id);

  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
  }

  return NextResponse.json(topic);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const existing = await getTopic(id);
  if (!existing) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { topic, persona, persona_id, category, weight, enabled } = body as {
      topic?: string;
      persona?: string;
      persona_id?: string;
      category?: string;
      weight?: number;
      enabled?: number;
    };

    const success = await updateTopic(id, {
      topic,
      persona,
      persona_id,
      category,
      weight,
      enabled,
    });

    if (!success) {
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }

    const updated = await getTopic(id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update topic error:', error);
    return NextResponse.json({ error: 'Failed to update topic' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const secret = _request.headers.get('authorization')?.replace('Bearer ', '');
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const existing = await getTopic(id);
  if (!existing) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
  }

  const success = await deleteTopic(id);

  if (!success) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }

  return NextResponse.json({ deleted: true, id });
}
