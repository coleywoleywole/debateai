import { Suspense } from 'react';
import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { d1 } from '@/lib/d1';
import { getOpponentById } from '@/lib/opponents';
import { debateJsonLd } from '@/lib/jsonld';
import DebateClient from './DebateClient';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://debateai.org';

// Generate dynamic metadata for SEO
export async function generateMetadata({
  params,
}: {
  params: Promise<{ debateId: string }>;
}): Promise<Metadata> {
  const { debateId } = await params;

  try {
    const result = await d1.getDebate(debateId);
    if (result.success && result.debate) {
      const debate = result.debate as Record<string, unknown>;
      const topic = (debate.topic as string) || 'AI Debate';
      const opponent = getOpponentById((debate.opponent || debate.character) as any);
      const opponentName = (debate.opponentStyle as string) || opponent?.name || 'AI';

      return {
        title: `${topic} — Debate vs ${opponentName}`,
        description: `Watch an AI debate about "${topic}". ${opponentName} argues the opposing position on DebateAI.`,
        openGraph: {
          title: `${topic} — AI Debate`,
          description: `An intellectual debate about "${topic}" on DebateAI.`,
          url: `${BASE_URL}/debate/${debateId}`,
          type: 'article',
          images: [{
            url: `${BASE_URL}/api/og?topic=${encodeURIComponent(topic)}&opponent=${encodeURIComponent(opponentName)}`,
            width: 1200,
            height: 630,
          }],
        },
        twitter: {
          card: 'summary_large_image',
          title: `${topic} — AI Debate`,
          description: `An intellectual debate about "${topic}" on DebateAI.`,
        },
      };
    }
  } catch (error) {
    console.error('generateMetadata: Failed to fetch debate:', error);
  }

  // Fallback metadata
  return {
    title: 'AI Debate',
    description: 'An intellectual debate on DebateAI.',
  };
}

// Server component — fetches debate data for SSR
// Crawlers see real HTML content; client hydrates with full interactivity
export default async function DebatePage({
  params,
}: {
  params: Promise<{ debateId: string }>;
}) {
  const { debateId } = await params;

  let debate: Record<string, unknown> | null = null;
  let messages: Array<{ role: string; content: string }> = [];
  let isOwner = false;

  try {
    const result = await d1.getDebate(debateId);
    if (result.success && result.debate) {
      debate = result.debate as Record<string, unknown>;
      messages = Array.isArray(debate.messages)
        ? (debate.messages as Array<{ role: string; content: string }>)
        : [];
      // Check ownership using Clerk auth
      const { userId } = await auth();
      isOwner = userId ? debate.user_id === userId : false;
    }
  } catch (error) {
    console.error('SSR: Failed to fetch debate:', error);
  }

  const opponent = debate
    ? getOpponentById((debate.opponent || debate.character) as any)
    : null;
  const topic = (debate?.topic as string) || '';
  const opponentName =
    (debate?.opponentStyle as string) || opponent?.name || 'AI Opponent';

  return (
    <>
      {/* JSON-LD structured data for search engines */}
      {debate && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              debateJsonLd({
                id: debate.id as string,
                topic,
                opponentName,
                messages,
                createdAt: debate.created_at as string | undefined,
              })
            ),
          }}
        />
      )}

      {/* SSR content — visible to crawlers even before JS loads */}
      {debate && (
        <noscript>
          <div style={{ maxWidth: '48rem', margin: '0 auto', padding: '2rem' }}>
            <h1>{topic}</h1>
            <p>A debate vs {opponentName} on DebateAI</p>
            {messages
              .filter((m) => m.role && m.content)
              .slice(0, 10)
              .map((msg, i) => (
                <div key={i} style={{ marginBottom: '1rem' }}>
                  <strong>{msg.role === 'user' ? 'User' : opponentName}:</strong>
                  <p>{msg.content}</p>
                </div>
              ))}
          </div>
        </noscript>
      )}

      {/* Hidden semantic content for crawlers — always in the DOM */}
      {debate && (
        <div
          className="sr-only"
          aria-hidden="true"
          data-testid="ssr-debate-content"
        >
          <h1>{topic}</h1>
          <p>Debate between a user and {opponentName} on DebateAI.org</p>
          {messages
            .filter((m) => m.role && m.content)
            .slice(0, 20)
            .map((msg, i) => (
              <div key={i}>
                <strong>{msg.role === 'user' ? 'User' : opponentName}</strong>
                <p>{msg.content}</p>
              </div>
            ))}
        </div>
      )}

      {/* Interactive client component with SSR data */}
      <Suspense
        fallback={
          <div className="min-h-screen flex flex-col items-center justify-center">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-[var(--text-secondary)]">Loading debate...</p>
            </div>
          </div>
        }
      >
        <DebateClient
          initialDebate={debate ? {
            id: debate.id as string,
            topic: topic,
            opponent: debate.opponent as string | undefined,
            character: debate.character as string | undefined,
            opponentStyle: debate.opponentStyle as string | undefined,
            messages: messages as any,
            score_data: debate.score_data as Record<string, unknown> | undefined,
          } : null}
          initialMessages={messages as any}
          initialIsOwner={isOwner}
        />
      </Suspense>
    </>
  );
}
