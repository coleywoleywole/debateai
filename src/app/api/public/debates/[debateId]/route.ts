import { NextResponse } from 'next/server';
import { d1 } from '@/lib/d1';
import { errors } from '@/lib/api-errors';

/**
 * GET /api/public/debates/[debateId]
 *
 * Fetches a debate for public, read-only viewing.
 * This endpoint does NOT require authentication.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ debateId: string }> }
) {
  try {
    const { debateId } = await params;

    if (!debateId) {
      return errors.badRequest('Debate ID required');
    }

    const result = await d1.getDebate(debateId);

    if (result.success && result.debate) {
      // Strip sensitive fields before sending the response
       
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { user_id: _, ...safeDebate } = result.debate as Record<string, unknown>;

      return NextResponse.json({
        debate: safeDebate,
      });
    }

    return errors.notFound('Debate not found');
  } catch (error) {
    console.error('Get public debate error:', error);
    return errors.internal('Failed to retrieve debate');
  }
}
