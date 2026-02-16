import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/stripe/webhook',  // Allow Stripe webhooks
  '/api/stripe/price',    // Allow public price check
  '/api/test-webhook',    // Test webhook endpoint
  '/api/share/(.*)',      // Public share metadata
  '/api/embed/(.*)',      // Public embed endpoint
  '/api/og',             // Public OG image generation
  '/api/trending',       // Public trending endpoint
  '/api/stats',          // Public platform stats
  '/api/metrics/(.*)',   // Metrics endpoints (temporary)
  '/api/topics/(.*)',    // Public daily topic + history
  '/api/health',         // Health check endpoint
  '/api/cron/(.*)',      // Vercel cron endpoints (protected by CRON_SECRET)
  '/api/email/unsubscribe', // One-click unsubscribe (CAN-SPAM — no auth required)
  '/settings/(.*)',      // Settings pages (handle auth client-side)
  '/blog',            // Public blog index
  '/blog/(.*)',        // Public blog posts
  '/compare/(.*)',    // SEO comparison pages
  '/tools/(.*)',      // SEO tools pages
  '/guides/(.*)',     // SEO guide pages
  '/topics/(.*)',     // Topic history page
  '/explore',        // Public explore page
  '/api/explore/(.*)', // Public explore APIs (rankings, debates)
  '/profile/(.*)',   // Public profile pages
  '/api/profile/public', // Public profile API
  '/debate',  // Allow access to debate setup page (will handle auth client-side)
  '/debate/(.*)',  // Allow debate pages to load and handle auth client-side
  '/api/debate(.*)', // Allow debate creation and messaging for guest users
  '/history',  // Allow history page to load and handle auth client-side
  '/robots.txt',      // SEO — must be public
  '/sitemap.xml',     // SEO — must be public
  '/api/admin/abandoned-users', // Emergency data export (key-protected)
])

export default clerkMiddleware(async (auth, req) => {
  // Skip auth in development mode when TEST_MODE is enabled
  if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_TEST_MODE === 'true') {
    return
  }
  
  // Protect all routes except the public ones
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
