import { NextResponse } from 'next/server';
import { d1 } from '@/lib/d1';
import { getUserId } from '@/lib/auth-helper';
import { logger } from '@/lib/logger';

const log = logger.scope('vote');

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { debateId, vote } = body;

    if (!debateId) {
      return NextResponse.json({ error: 'Missing debateId' }, { status: 400 });
    }

    // Validate vote type
    if (vote !== 'up' && vote !== 'down' && vote !== null) {
      return NextResponse.json({ error: 'Invalid vote type' }, { status: 400 });
    }

    let userId = await getUserId();
    let setCookie = false;
    let guestUuid = '';

    if (!userId) {
      // Generate guest ID if not present
      guestUuid = crypto.randomUUID();
      userId = `guest_${guestUuid}`;
      setCookie = true;
    }

    // Call d1.vote
    await d1.vote(debateId, userId, vote);

    // Log feedback
    await d1.logAnalyticsEvent({
      eventType: 'user_feedback_submitted',
      debateId,
      userId,
      properties: {
        vote,
        type: 'vote'
      }
    });

    // Get updated counts
    const counts = await d1.getVoteCounts(debateId);

    log.info('cast', {
      debateId,
      userId,
      vote,
      newCounts: counts
    });

    const response = NextResponse.json({ success: true, ...counts });

    if (setCookie) {
      // Set cookie for 1 year
      response.cookies.set('guest_id', guestUuid, { 
        path: '/', 
        maxAge: 31536000, // 1 year
        sameSite: 'lax' 
      });
    }

    return response;
  } catch (error) {
    console.error('Vote error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
