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
  eslint: {
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      {
        source: '/explore',
        destination: '/leaderboard',
        permanent: true,
      },
    ];
  },
  webpack: (config, { isServer }) => {
    // Suppress warnings about critical dependencies in Sentry/Prisma/OpenTelemetry
    // We don't use Prisma, but Sentry tries to load its instrumentation
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      { module: /node_modules\/@prisma\/instrumentation/ },
      { module: /node_modules\/@opentelemetry\/instrumentation/ },
    ];
    return config;
  },
};

export default withBundleAnalyzer(nextConfig);
