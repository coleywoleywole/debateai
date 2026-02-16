import type { Metadata } from "next";
import { ClerkProvider } from '@clerk/nextjs';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import { ThemeProvider } from '@/components/ThemeProvider';
import { ToastProvider } from '@/components/Toast';
import ArtisticBackground from '@/components/backgrounds/ArtisticBackground';
import AnalyticsProvider from '@/components/AnalyticsProvider';
import PageViewTracker from '@/components/PageViewTracker';
import SentryProvider from '@/components/SentryProvider';
import { websiteJsonLd } from '@/lib/jsonld';
import "./globals.css";

/**
 * Wrapper that renders ClerkProvider only when the publishable key is available.
 * During `next build`, static pages like `/_not-found` are prerendered without
 * runtime env vars — ClerkProvider throws if the key is missing.
 * This wrapper lets those pages build without Clerk, while all runtime pages
 * still get full auth (the key is always available at runtime on Vercel).
 */
function AuthProvider({ children }: { children: React.ReactNode }) {
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!clerkKey) {
    // Build-time prerender (no env vars) — skip Clerk
    return <>{children}</>;
  }
  return (
    <ClerkProvider
      appearance={{
        elements: {
          modalBackdrop: "flex items-center justify-center bg-black/60 backdrop-blur-sm p-4",
          modalContent: "w-full max-w-[calc(100vw-2rem)] sm:max-w-[400px] mx-auto my-auto overflow-hidden",
          card: "w-full shadow-xl rounded-xl overflow-hidden box-border bg-background max-w-full",
          headerTitle: "text-lg sm:text-xl font-bold text-center break-words px-4 whitespace-normal",
          headerSubtitle: "text-center break-words text-muted-foreground px-4 text-sm whitespace-normal",
          socialButtonsBlockButton: "w-full h-auto py-3 whitespace-normal break-words text-sm flex items-center justify-center gap-2 max-w-full",
          footerActionLink: "text-primary hover:text-primary-600",
          formButtonPrimary: "bg-primary-600 hover:bg-primary-700 text-white w-full",
          rootBox: "w-full flex justify-center",
        }
      }}
    >
      {children}
    </ClerkProvider>
  );
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://debateai.org';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "DebateAI — Challenge Your Convictions",
    template: "%s | DebateAI",
  },
  description: "Challenge your beliefs against AI trained to argue from every perspective. Sharpen your critical thinking through rigorous intellectual debate.",
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/favicon-32.png',
    apple: '/favicon-512.png',
  },
  openGraph: {
    type: 'website',
    siteName: 'DebateAI',
    title: 'DebateAI — Challenge Your Convictions',
    description: 'Challenge your beliefs against AI trained to argue from every perspective.',
    url: BASE_URL,
    images: [{ url: `${BASE_URL}/api/og`, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DebateAI — Challenge Your Convictions',
    description: 'Challenge your beliefs against AI trained to argue from every perspective.',
    images: [`${BASE_URL}/api/og`],
  },
  alternates: {
    canonical: BASE_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          {/* Preconnect to external services for faster resource loading */}
          <link rel="preconnect" href="https://clerk.debateai.org" crossOrigin="anonymous" />
          <link rel="dns-prefetch" href="https://clerk.debateai.org" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(websiteJsonLd()),
            }}
          />
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
          <meta name="theme-color" content="#0c0a09" media="(prefers-color-scheme: dark)" />
          <meta name="theme-color" content="#fafaf9" media="(prefers-color-scheme: light)" />
        </head>
        <body
          className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} antialiased`}
        >
          <ArtisticBackground />
          <a href="#main-content" className="skip-link">
            Skip to main content
          </a>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <ToastProvider>
              <main id="main-content" tabIndex={-1}>
                {children}
              </main>
            </ToastProvider>
          </ThemeProvider>
          <AnalyticsProvider />
          <PageViewTracker />
          <SentryProvider />
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </AuthProvider>
  );
}
