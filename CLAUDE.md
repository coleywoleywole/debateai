# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## CRITICAL: Claude API Model Configuration

**ALWAYS use model `claude-sonnet-4-20250514` for all Claude API calls**
- This is the latest and most capable Claude model
- Do NOT use older models like `claude-3-5-sonnet-*` 
- This model supports web search via the `web_search_20250305` tool

## Common Development Commands

### Development Server
```bash
yarn dev          # Start development server with Turbopack on http://localhost:3000
```

### Build & Production
```bash
yarn build        # Build for production
yarn start        # Start production server
```

### Code Quality
```bash
yarn lint         # Run ESLint for code linting
```

### Testing
```bash
npx playwright test                      # Run all Playwright tests
npx playwright test tests/homepage.spec.ts  # Run specific test file
npx playwright test --ui                 # Run tests with UI mode
npx playwright test --debug              # Debug tests
```

## Architecture Overview

### Tech Stack
- **Framework**: Next.js 15.4 with App Router and TypeScript
- **UI**: Tailwind CSS v4 with professional design system
- **Authentication**: Clerk (clerk.com)
- **AI**: OpenRouter API for Claude models (free tier)
- **Database**: Cloudflare D1 (SQLite at edge)
- **Storage**: AWS S3 for avatar uploads
- **Payments**: Stripe for premium subscriptions
- **Testing**: Playwright for E2E tests

### Project Structure

```
src/
├── app/                 # Next.js App Router pages and API routes
│   ├── api/            # API endpoints
│   │   ├── debate/     # Debate creation and streaming
│   │   ├── stripe/     # Payment integration
│   │   └── avatar/     # User avatar management
│   ├── debate/         # Debate UI pages
│   └── history/        # User debate history
├── components/         # React components
├── lib/               # Core business logic
│   ├── openrouter-debate.ts  # AI debate logic using OpenRouter
│   ├── d1.ts          # Cloudflare D1 database client
│   ├── stripe.ts      # Stripe payment handling
│   └── characters.tsx  # Character definitions and personalities
└── middleware.ts       # Clerk authentication middleware
```

### Key Architectural Patterns

1. **Streaming AI Responses**: The debate API (`/api/debate/route.ts`) uses Server-Sent Events to stream AI responses in real-time, providing a smooth user experience.

2. **Database Design**: Uses Cloudflare D1 REST API from Vercel deployment. Key tables:
   - `debates`: Stores debate history with messages as JSON
   - `users`: Manages subscription status
   - `leaderboard`: Tracks user scores and stats

3. **Opponent System**: Different AI debate opponents with unique styles (Socratic, Logical, Devil's Advocate, Academic, Pragmatist) defined in `/lib/opponents.ts` with corresponding prompts in `/lib/debate-prompts.ts`.

4. **Rate Limiting**: Free users limited to 3 debates and 3 messages per debate. Premium users get unlimited access.

5. **Authentication Flow**: Clerk handles auth with middleware protecting `/debate` and `/api` routes. User state synced with D1 database.

## Environment Variables Required

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# OpenRouter AI (free tier)
OPENROUTER_API_KEY=

# Cloudflare D1 Database
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_D1_DATABASE_ID=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_EMAIL=

# AWS S3 (optional, for avatars)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_S3_BUCKET_NAME=

# Stripe (optional, for payments)
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
```

## Important Implementation Notes

1. **OpenRouter Integration**: The app uses OpenRouter's free tier with Claude models. Rate limiting is handled client-side based on user subscription status.

2. **Debate State Management**: Debates are saved after each message exchange. The debate ID is generated client-side and passed through the streaming response.

3. **Subscription System**: Stripe webhooks update user subscription status in D1. The subscription check happens at the API level before processing requests.

4. **Error Handling**: All API routes include try-catch blocks with appropriate error responses. Database operations fail gracefully if D1 is not configured.

5. **Debate Styles**: Each opponent type has specific argumentation patterns and approaches defined through system prompts, ensuring intellectually consistent debate experiences.

## Communicating with Sketch (UI/Design Agent)

Sketch is a design-focused agent that handles UI/visual work. It operates in the `#sketch` Discord channel.

### How to talk to Sketch
- **Require mention**: You MUST mention `<@1465238762807099440>` in your message or Sketch won't respond
- **Channel**: `#sketch` (ID: `1468692375042785424`)
- **Don't give design direction**: Tell Sketch WHAT needs fixing (the problem, broken behavior, which file/component), but do NOT tell it HOW to design or style it. Sketch has better design instincts — let it decide the visual approach.
- **Tell it to run tests**: Remind Sketch to run `npx playwright test tests/e2e/critical-journeys.spec.ts --project=chromium` after changes
- **CRITICAL — Tell Sketch NOT to change API calls or business logic**: Sketch is a design agent and must ONLY modify CSS, classes, HTML structure, and visual presentation. It must NOT change: API endpoint URLs (`fetch('/api/...')`), request/response handling, SSE/streaming logic, sessionStorage keys, state management logic, or any non-visual JavaScript. If Sketch needs backend changes, it should flag them for you to handle.

### Example message to Sketch
Write your message JSON to a file, then send:
```bash
echo '{"message": "<@1465238762807099440> The verdict button on the debate page is overlapping the input bar. File: src/app/debate/[debateId]/DebateClient.tsx — search for Request Verdict. Please run tests after."}' > /tmp/msg.json
curl -s -X POST http://localhost:3456/send -H "Content-Type: application/json" -d @/tmp/msg.json
```

### Reading Sketch's replies
```bash
curl -s "http://localhost:3456/messages?limit=10"
```

### Bot setup
The Discord bot at `/Users/spud/discord-bot/` must be running. Start it with:
```bash
cd /Users/spud/discord-bot && node bot.js &
```
Then set the channel:
```bash
curl -s -X POST http://localhost:3456/channel -H "Content-Type: application/json" -d '{"channelId": "1468692375042785424"}'
```