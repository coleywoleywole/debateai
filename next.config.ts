import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  // Standalone output for Docker/Coolify
  output: 'standalone',

  // Sentry is initialized via:
  // - instrumentation.ts for server/edge (auto-detected by Next.js)
  // - SentryProvider component for client
  // No withSentryConfig wrapper needed (causes issues with Next.js 15)
  
  // Image optimization - serve modern formats
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  
  // Experimental optimizations
  experimental: {
    // Optimize package imports for smaller bundles
    optimizePackageImports: ['@clerk/nextjs', 'sonner'],
  },
  async redirects() {
    return [
      {
        source: '/leaderboard',
        destination: '/explore',
        permanent: true,
      },
      {
        source: '/api/leaderboard',
        destination: '/api/explore',
        permanent: true,
      },
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'debateai.org',
          },
        ],
        destination: 'https://www.debateai.org/:path*',
        permanent: true, // Defaults to 308 (Permanent Redirect) which preserves method (POST->POST)
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
