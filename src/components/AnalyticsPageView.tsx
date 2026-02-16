'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics';

/**
 * Client component that fires analytics events on mount.
 * Drop into server components that need tracking.
 */

interface BlogPostViewProps {
  type: 'blog_post';
  slug: string;
  title: string;
  tags: string[];
  readingTime: number;
}

interface PageViewProps {
  type: 'page';
  path: string;
  title: string;
}

type AnalyticsPageViewProps = BlogPostViewProps | PageViewProps;

export default function AnalyticsPageView(props: AnalyticsPageViewProps) {
  useEffect(() => {
    if (props.type === 'blog_post') {
      track('blog_post_viewed', {
        slug: props.slug,
        title: props.title,
        tags: props.tags,
        readingTime: props.readingTime,
      });
    } else {
      track('page_viewed', {
        path: props.path,
        title: props.title,
        referrer: typeof document !== 'undefined' ? document.referrer : undefined,
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
