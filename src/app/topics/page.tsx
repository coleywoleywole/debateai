import type { Metadata } from 'next';
import TopicsBrowseClient from './TopicsBrowseClient';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://debateai.org';

export const metadata: Metadata = {
  title: 'Browse Debate Topics — DebateAI',
  description:
    'Explore 150+ debate topics across philosophy, ethics, technology, politics, and more. Pick a topic and challenge AI to a real-time debate.',
  alternates: {
    canonical: `${BASE_URL}/topics`,
  },
  openGraph: {
    title: 'Browse Debate Topics — DebateAI',
    description:
      'Explore 150+ debate topics across philosophy, ethics, technology, politics, and more.',
    url: `${BASE_URL}/topics`,
    type: 'website',
    siteName: 'DebateAI',
    images: [
      {
        url: `${BASE_URL}/api/og`,
        width: 1200,
        height: 630,
        alt: 'DebateAI Topics',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Browse Debate Topics — DebateAI',
    description:
      'Explore 150+ debate topics across philosophy, ethics, technology, politics, and more.',
    images: [`${BASE_URL}/api/og`],
  },
};

export default function TopicsPage() {
  return <TopicsBrowseClient />;
}
