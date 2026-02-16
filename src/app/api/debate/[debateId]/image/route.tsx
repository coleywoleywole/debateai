import { ImageResponse } from 'next/og';
import { d1 } from '@/lib/d1';

export const runtime = 'edge';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ debateId: string }> }
) {
  try {
    const { debateId } = await params;
    
    // Fetch debate data
    const result = await d1.getDebate(debateId);
    
    if (!result.success || !result.debate) {
      return new Response('Debate not found', { status: 404 });
    }
    
    const debate = result.debate as any;
    const topic = debate.topic as string;
    const winner = debate.winner as string | undefined;
    
    // Determine status text
    let statusText = 'Debate in Progress';
    let statusColor = '#94a3b8'; // slate-400
    
    if (winner) {
      if (winner === 'user') {
        statusText = 'Winner: User';
        statusColor = '#4ade80'; // green-400
      } else if (winner === 'ai') {
        statusText = 'Winner: AI';
        statusColor = '#f87171'; // red-400
      } else {
        statusText = 'Draw';
        statusColor = '#fbbf24'; // amber-400
      }
    }

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0f172a', // slate-900
            backgroundImage: 'radial-gradient(circle at 25px 25px, #1e293b 2%, transparent 0%), radial-gradient(circle at 75px 75px, #1e293b 2%, transparent 0%)',
            backgroundSize: '100px 100px',
            color: 'white',
            fontFamily: 'sans-serif',
            padding: '40px',
            position: 'relative',
          }}
        >
          {/* Logo / Brand */}
          <div
            style={{
              position: 'absolute',
              top: 60,
              left: 60,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: '#38bdf8', // sky-400
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              DebateAI
            </div>
          </div>

          {/* Content */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              maxWidth: '900px',
            }}
          >
            <h1
              style={{
                fontSize: 72,
                fontWeight: 900,
                lineHeight: 1.1,
                marginBottom: 40,
                background: 'linear-gradient(to bottom right, #ffffff 30%, #94a3b8)',
                backgroundClip: 'text',
                color: 'transparent',
                textAlign: 'center',
                textShadow: '0 4px 8px rgba(0,0,0,0.5)',
              }}
            >
              {topic}
            </h1>
            
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 20,
              }}
            >
              <div
                style={{
                  padding: '20px 40px',
                  backgroundColor: 'rgba(30, 41, 59, 0.8)',
                  borderRadius: '9999px',
                  border: '2px solid #334155',
                  fontSize: 32,
                  fontWeight: 600,
                  color: statusColor,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              >
                {statusText}
              </div>
            </div>
          </div>
          
          {/* Footer URL */}
          <div
            style={{
              position: 'absolute',
              bottom: 40,
              display: 'flex',
              justifyContent: 'center',
              width: '100%',
              fontSize: 24,
              color: '#64748b',
              fontWeight: 500,
            }}
          >
            debateai.org
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e) {
    console.error(e);
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}
