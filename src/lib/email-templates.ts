/**
 * Email templates — inline-styled HTML for maximum compatibility.
 *
 * All templates include:
 * - Unsubscribe link (CAN-SPAM compliant)
 * - Physical mailing address placeholder
 * - Mobile-responsive layout
 */

import { getUnsubscribeUrl, getDebateUrl } from './email';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://debateai.org';

/* ------------------------------------------------------------------ */
/*  Shared layout                                                      */
/* ------------------------------------------------------------------ */

function emailLayout(content: string, unsubscribeToken: string): string {
  const unsubscribeUrl = getUnsubscribeUrl(unsubscribeToken);
  const preferencesUrl = `${BASE_URL}/settings/email`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DebateAI</title>
</head>
<body style="margin:0;padding:0;background-color:#0c0a09;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <!-- Main wrapper with subtle gradient border effect -->
  <div style="background:linear-gradient(180deg,#1c1917 0%,#0c0a09 100%);min-height:100vh;padding:40px 16px;">
    <div style="max-width:600px;margin:0 auto;">
      
      <!-- Logo header -->
      <div style="text-align:center;margin-bottom:32px;padding:0 0 24px 0;">
        <a href="${BASE_URL}" style="text-decoration:none;display:inline-block;">
          <span style="font-size:24px;font-weight:800;color:#fafaf9;letter-spacing:-0.03em;background:linear-gradient(135deg,#fbbf24 0%,#f59e0b 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">DebateAI</span>
        </a>
        <div style="width:40px;height:2px;background:linear-gradient(90deg,transparent,#f59e0b,transparent);margin:12px auto 0;"></div>
      </div>

      <!-- Content card -->
      <div style="background:linear-gradient(180deg,#1c1917 0%,#181412 100%);border:1px solid #292524;border-radius:20px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5),0 0 0 1px rgba(245,158,11,0.05);overflow:hidden;">
        <div style="padding:40px 32px;">
          ${content}
        </div>
      </div>

      <!-- Footer -->
      <div style="margin-top:32px;padding-top:24px;text-align:center;">
        <p style="font-size:13px;color:#78716c;line-height:1.6;margin:0 0 12px;">
          <a href="${preferencesUrl}" style="color:#a8a29e;text-decoration:none;transition:color 0.2s;">Email preferences</a>
          <span style="color:#44403c;margin:0 8px;">·</span>
          <a href="${unsubscribeUrl}" style="color:#a8a29e;text-decoration:none;transition:color 0.2s;">Unsubscribe</a>
        </p>
        <p style="font-size:12px;color:#57534e;margin:0;line-height:1.5;">
          DebateAI · Challenge your convictions
        </p>
        <p style="font-size:11px;color:#44403c;margin:8px 0 0;">
          Sent with 💡 from San Francisco
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/*  Daily topic digest                                                 */
/* ------------------------------------------------------------------ */

export function dailyTopicEmail(opts: {
  topic: string;
  persona: string;
  category: string;
  unsubscribeToken: string;
}): { subject: string; html: string } {
  const debateUrl = getDebateUrl(opts.topic);

  const CATEGORY_EMOJI: Record<string, string> = {
    philosophy: '🧠',
    ethics: '⚖️',
    technology: '💻',
    society: '🏙️',
    science: '🔬',
    relationships: '💬',
    business: '💼',
    'pop-culture': '🎬',
    'hot-takes': '🔥',
    politics: '🏛️',
  };

  const emoji = CATEGORY_EMOJI[opts.category] ?? '💡';

  const content = `
    <!-- Category badge -->
    <div style="text-align:center;margin-bottom:24px;">
      <span style="display:inline-flex;align-items:center;gap:6px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.2);border-radius:100px;padding:8px 16px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#fbbf24;">
        ${emoji} Today's Debate
      </span>
    </div>

    <!-- Topic heading -->
    <h1 style="font-size:28px;font-weight:700;color:#fafaf9;margin:0 0 20px;line-height:1.25;text-align:center;font-family:Georgia,'Times New Roman',serif;letter-spacing:-0.01em;">
      ${escapeHtml(opts.topic)}
    </h1>

    <!-- Divider -->
    <div style="width:60px;height:2px;background:linear-gradient(90deg,#f59e0b,#fbbf24);border-radius:2px;margin:0 auto 24px;"></div>

    <!-- Opponent info -->
    <div style="background:rgba(28,25,23,0.5);border:1px solid #292524;border-radius:12px;padding:16px 20px;margin-bottom:28px;text-align:center;">
      <p style="font-size:14px;color:#a8a29e;margin:0;">
        Your opponent: <span style="color:#fbbf24;font-weight:600;">${escapeHtml(opts.persona)}</span>
      </p>
    </div>

    <!-- CTA Button -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${debateUrl}" style="display:inline-block;background:linear-gradient(135deg,#f59e0b 0%,#fbbf24 100%);color:#0c0a09;font-size:15px;font-weight:700;padding:16px 32px;border-radius:12px;text-decoration:none;box-shadow:0 10px 40px -10px rgba(245,158,11,0.4),inset 0 1px 0 rgba(255,255,255,0.2);transition:transform 0.2s;">
        Start Debating →
      </a>
    </div>

    <!-- Teaser text -->
    <p style="font-size:14px;color:#78716c;text-align:center;line-height:1.6;margin:0;font-style:italic;">
      Think you can win? The AI won't go easy on you.
    </p>
  `;

  return {
    subject: `Today's debate: ${opts.topic}`,
    html: emailLayout(content, opts.unsubscribeToken),
  };
}

/* ------------------------------------------------------------------ */
/*  Welcome email                                                      */
/* ------------------------------------------------------------------ */

export function welcomeEmail(opts: {
  name?: string;
  unsubscribeToken: string;
}): { subject: string; html: string } {
  const greeting = opts.name ? `Hey ${escapeHtml(opts.name)}` : 'Welcome';

  const content = `
    <!-- Welcome icon -->
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;background:linear-gradient(135deg,rgba(245,158,11,0.2),rgba(245,158,11,0.05));border:1px solid rgba(245,158,11,0.2);border-radius:16px;font-size:28px;">
        🎯
      </div>
    </div>

    <h1 style="font-size:28px;font-weight:700;color:#fafaf9;margin:0 0 16px;text-align:center;font-family:Georgia,'Times New Roman',serif;line-height:1.2;">
      ${greeting}, you're in.
    </h1>
    
    <p style="font-size:16px;color:#a8a29e;text-align:center;line-height:1.7;margin:0 0 28px;">
      Every morning at 9am, we'll send you a fresh debate topic with an AI opponent ready to fight.
      No prep needed — just show up with an opinion.
    </p>

    <!-- Feature highlights -->
    <div style="background:rgba(28,25,23,0.3);border:1px solid #292524;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        <span style="font-size:18px;">🧠</span>
        <span style="font-size:14px;color:#d6d3d1;">AI opponents that research & cite real sources</span>
      </div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        <span style="font-size:18px;">📊</span>
        <span style="font-size:14px;color:#d6d3d1;">Detailed scoring and performance tracking</span>
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:18px;">🔥</span>
        <span style="font-size:14px;color:#d6d3d1;">Daily streaks to keep you sharp</span>
      </div>
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${BASE_URL}/debate" style="display:inline-block;background:linear-gradient(135deg,#f59e0b 0%,#fbbf24 100%);color:#0c0a09;font-size:15px;font-weight:700;padding:16px 32px;border-radius:12px;text-decoration:none;box-shadow:0 10px 40px -10px rgba(245,158,11,0.4),inset 0 1px 0 rgba(255,255,255,0.2);">
        Start Your First Debate
      </a>
    </div>

    <p style="font-size:13px;color:#78716c;text-align:center;line-height:1.6;margin:0;">
      You'll also get weekly recaps of your debate stats and notifications when someone challenges your debates.
    </p>
  `;

  return {
    subject: "You're in — your first debate topic drops tomorrow at 9am",
    html: emailLayout(content, opts.unsubscribeToken),
  };
}

/* ------------------------------------------------------------------ */
/*  Unsubscribe confirmation                                          */
/* ------------------------------------------------------------------ */

export function unsubscribeConfirmationEmail(opts: {
  email: string;
  unsubscribeToken: string;
}): { subject: string; html: string } {
  const resubscribeUrl = `${BASE_URL}/settings/email`;

  const content = `
    <div style="text-align:center;padding:20px 0;">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;background:rgba(120,113,108,0.1);border:1px solid rgba(120,113,108,0.2);border-radius:16px;font-size:24px;margin-bottom:20px;">
        👋
      </div>
      
      <h1 style="font-size:24px;font-weight:700;color:#fafaf9;margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;">
        You've been unsubscribed
      </h1>
      
      <p style="font-size:15px;color:#a8a29e;line-height:1.7;margin:0 0 24px;">
        You won't receive any more emails from DebateAI.<br>
        Changed your mind? You can always re-subscribe.
      </p>
      
      <a href="${resubscribeUrl}" style="display:inline-block;background:transparent;border:1px solid #44403c;color:#d6d3d1;font-size:14px;font-weight:500;padding:12px 24px;border-radius:10px;text-decoration:none;transition:all 0.2s;">
        Re-subscribe →
      </a>
    </div>
  `;

  return {
    subject: "You've been unsubscribed from DebateAI",
    html: emailLayout(content, opts.unsubscribeToken),
  };
}

/* ------------------------------------------------------------------ */
/*  Weekly Recap                                                       */
/* ------------------------------------------------------------------ */

export function weeklyRecapEmail(opts: {
  stats: {
    totalDebates: number;
    bestScore: number;
    bestTopic: string;
    streakCount: number;
  };
  trendingTopic: string;
  unsubscribeToken: string;
}): { subject: string; html: string } {
  const { stats, trendingTopic } = opts;
  
  let subject = `Your week in arguments: ${stats.totalDebates} debates`;
  if (stats.bestScore > 0) {
    subject += `, ${stats.bestScore}% best score`;
  }

  let content = '';

  if (stats.totalDebates === 0) {
    content = `
      <div style="text-align:center;margin-bottom:24px;">
        <div style="font-size:48px;margin-bottom:8px;">😴</div>
      </div>
      
      <h1 style="font-size:24px;font-weight:700;color:#fafaf9;margin:0 0 16px;line-height:1.3;text-align:center;font-family:Georgia,'Times New Roman',serif;">
        You took the week off.
      </h1>
      
      <p style="font-size:15px;color:#a8a29e;line-height:1.7;margin:0 0 28px;text-align:center;">
        It's been preparing new arguments. Ready to test them?
      </p>
    `;
  } else {
    content = `
      <div style="text-align:center;margin-bottom:8px;">
        <span style="display:inline-flex;align-items:center;gap:6px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2);border-radius:100px;padding:6px 14px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#34d399;">
          📊 Weekly Recap
        </span>
      </div>

      <h1 style="font-size:26px;font-weight:700;color:#fafaf9;margin:0 0 28px;line-height:1.2;text-align:center;font-family:Georgia,'Times New Roman',serif;">
        Your week on DebateAI
      </h1>

      <!-- Stats grid -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px;">
        <div style="background:rgba(28,25,23,0.5);border:1px solid #292524;border-radius:12px;padding:20px;text-align:center;">
          <div style="font-size:32px;font-weight:800;color:#fbbf24;margin-bottom:4px;">${stats.totalDebates}</div>
          <div style="font-size:12px;color:#78716c;text-transform:uppercase;letter-spacing:0.05em;">Debates</div>
        </div>
        <div style="background:rgba(28,25,23,0.5);border:1px solid #292524;border-radius:12px;padding:20px;text-align:center;">
          <div style="font-size:32px;font-weight:800;color:#fbbf24;margin-bottom:4px;">${stats.streakCount}</div>
          <div style="font-size:12px;color:#78716c;text-transform:uppercase;letter-spacing:0.05em;">Day Streak</div>
        </div>
      </div>

      ${stats.bestScore > 0 ? `
      <div style="background:linear-gradient(135deg,rgba(245,158,11,0.08),rgba(245,158,11,0.02));border:1px solid rgba(245,158,11,0.15);border-radius:12px;padding:20px;margin-bottom:24px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="font-size:20px;">🏆</span>
          <span style="font-size:13px;font-weight:600;color:#fbbf24;text-transform:uppercase;letter-spacing:0.05em;">Best Performance</span>
        </div>
        <div style="font-size:22px;font-weight:700;color:#fafaf9;margin-bottom:4px;">${stats.bestScore}%</div>
        <div style="font-size:14px;color:#a8a29e;font-style:italic;">"${escapeHtml(stats.bestTopic)}"</div>
      </div>
      ` : ''}
    `;
  }

  content += `
    <!-- Trending topic -->
    <div style="background:rgba(28,25,23,0.3);border:1px solid #292524;border-radius:12px;padding:20px;margin-bottom:28px;">
      <p style="font-size:12px;font-weight:600;color:#78716c;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px;">
        🔥 Trending this week
      </p>
      <p style="font-size:16px;color:#d6d3d1;font-weight:600;margin:0;line-height:1.4;">
        "${escapeHtml(trendingTopic)}"
      </p>
    </div>

    <div style="text-align:center;">
      <a href="${BASE_URL}/debate" style="display:inline-block;background:linear-gradient(135deg,#f59e0b 0%,#fbbf24 100%);color:#0c0a09;font-size:15px;font-weight:700;padding:16px 32px;border-radius:12px;text-decoration:none;box-shadow:0 10px 40px -10px rgba(245,158,11,0.4);">
        Jump Back In →
      </a>
    </div>
  `;

  return {
    subject,
    html: emailLayout(content, opts.unsubscribeToken),
  };
}

/* ------------------------------------------------------------------ */
/*  Challenge Notification                                             */
/* ------------------------------------------------------------------ */

export function challengeNotificationEmail(opts: {
  topic: string;
  userScore: number;
  opponentScore: number;
  unsubscribeToken: string;
}): { subject: string; html: string } {
  const won = opts.userScore > opts.opponentScore;
  const tied = opts.userScore === opts.opponentScore;
  
  const content = `
    <div style="text-align:center;margin-bottom:20px;">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;background:linear-gradient(135deg,rgba(239,68,68,0.15),rgba(239,68,68,0.05));border:1px solid rgba(239,68,68,0.2);border-radius:16px;font-size:24px;">
        ⚔️
      </div>
    </div>

    <h1 style="font-size:24px;font-weight:700;color:#fafaf9;margin:0 0 16px;line-height:1.3;text-align:center;font-family:Georgia,'Times New Roman',serif;">
      Someone challenged your position
    </h1>
    
    <p style="font-size:15px;color:#a8a29e;line-height:1.7;margin:0 0 24px;text-align:center;">
      Another debater took the opposite side on <strong style="color:#d6d3d1;">"${escapeHtml(opts.topic)}"</strong>
    </p>

    <!-- Score comparison -->
    <div style="background:rgba(28,25,23,0.5);border:1px solid #292524;border-radius:16px;padding:24px;margin-bottom:28px;">
      <div style="display:flex;align-items:center;justify-content:center;gap:20px;margin-bottom:16px;">
        <!-- Your score -->
        <div style="text-align:center;">
          <div style="font-size:36px;font-weight:800;color:${won ? '#34d399' : '#fbbf24'};margin-bottom:4px;">${opts.userScore}</div>
          <div style="font-size:12px;color:#78716c;">Your Score</div>
        </div>
        
        <!-- VS -->
        <div style="font-size:14px;font-weight:700;color:#57534e;">VS</div>
        
        <!-- Their score -->
        <div style="text-align:center;">
          <div style="font-size:36px;font-weight:800;color:${!won && !tied ? '#f87171' : '#fbbf24'};margin-bottom:4px;">${opts.opponentScore}</div>
          <div style="font-size:12px;color:#78716c;">Their Score</div>
        </div>
      </div>
      
      <div style="text-align:center;padding-top:16px;border-top:1px solid #292524;">
        <span style="font-size:14px;font-weight:600;color:${won ? '#34d399' : tied ? '#fbbf24' : '#f87171'};">
          ${won ? '👑 You\'re winning!' : tied ? '🤝 It\'s a tie!' : '💪 They\'re ahead'}
        </span>
      </div>
    </div>

    <p style="font-size:14px;color:#a8a29e;line-height:1.6;margin:0 0 24px;text-align:center;">
      Think you can beat both the AI <em>and</em> their score?
    </p>

    <div style="text-align:center;">
      <a href="${getDebateUrl(opts.topic)}" style="display:inline-block;background:linear-gradient(135deg,#f59e0b 0%,#fbbf24 100%);color:#0c0a09;font-size:15px;font-weight:700;padding:16px 32px;border-radius:12px;text-decoration:none;box-shadow:0 10px 40px -10px rgba(245,158,11,0.4);">
        Defend Your Position →
      </a>
    </div>
  `;

  return {
    subject: `Someone just argued the opposite of your position on "${opts.topic}"`,
    html: emailLayout(content, opts.unsubscribeToken),
  };
}

/* ------------------------------------------------------------------ */
/*  Win-back (7-day inactive)                                          */
/* ------------------------------------------------------------------ */

export function winBackEmail(opts: {
  trendingTopic: string;
  count: number;
  aiWinPct: number;
  unsubscribeToken: string;
}): { subject: string; html: string } {
  const content = `
    <div style="text-align:center;margin-bottom:20px;">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;background:linear-gradient(135deg,rgba(245,158,11,0.15),rgba(245,158,11,0.05));border:1px solid rgba(245,158,11,0.2);border-radius:16px;font-size:24px;">
        🔥
      </div>
    </div>

    <h1 style="font-size:24px;font-weight:700;color:#fafaf9;margin:0 0 16px;line-height:1.3;text-align:center;font-family:Georgia,'Times New Roman',serif;">
      The debate everyone's talking about
    </h1>
    
    <div style="background:linear-gradient(135deg,rgba(245,158,11,0.08),rgba(245,158,11,0.02));border:1px solid rgba(245,158,11,0.15);border-radius:16px;padding:24px;margin-bottom:24px;">
      <p style="font-size:18px;color:#fafaf9;font-weight:600;margin:0 0 16px;line-height:1.4;text-align:center;">
        "${escapeHtml(opts.trendingTopic)}"
      </p>
      
      <div style="display:flex;justify-content:center;gap:24px;">
        <div style="text-align:center;">
          <div style="font-size:24px;font-weight:700;color:#fbbf24;">${opts.count}</div>
          <div style="font-size:11px;color:#78716c;text-transform:uppercase;letter-spacing:0.05em;">Debates</div>
        </div>
        <div style="width:1px;background:#292524;"></div>
        <div style="text-align:center;">
          <div style="font-size:24px;font-weight:700;color:#fbbf24;">${opts.aiWinPct}%</div>
          <div style="font-size:11px;color:#78716c;text-transform:uppercase;letter-spacing:0.05em;">AI Win Rate</div>
        </div>
      </div>
    </div>

    <p style="font-size:15px;color:#a8a29e;line-height:1.7;margin:0 0 28px;text-align:center;">
      You've been quiet. The AI hasn't.
    </p>

    <div style="text-align:center;">
      <a href="${getDebateUrl(opts.trendingTopic)}" style="display:inline-block;background:linear-gradient(135deg,#f59e0b 0%,#fbbf24 100%);color:#0c0a09;font-size:15px;font-weight:700;padding:16px 32px;border-radius:12px;text-decoration:none;box-shadow:0 10px 40px -10px rgba(245,158,11,0.4);">
        See What You're Missing →
      </a>
    </div>
  `;

  return {
    subject: `The debate topic everyone's arguing about this week`,
    html: emailLayout(content, opts.unsubscribeToken),
  };
}

/* ------------------------------------------------------------------ */
/*  Streak Warning                                                     */
/* ------------------------------------------------------------------ */

export function streakWarningEmail(opts: {
  streak: number;
  unsubscribeToken: string;
}): { subject: string; html: string } {
  const content = `
    <div style="text-align:center;margin-bottom:20px;">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;background:linear-gradient(135deg,rgba(245,158,11,0.2),rgba(245,158,11,0.05));border:1px solid rgba(245,158,11,0.25);border-radius:16px;font-size:28px;animation:pulse 2s infinite;">
        🔥
      </div>
    </div>

    <div style="text-align:center;margin-bottom:16px;">
      <span style="display:inline-flex;align-items:center;gap:6px;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.25);border-radius:100px;padding:8px 16px;font-size:12px;font-weight:700;color:#fbbf24;">
        ⚠️ Streak Expires Soon
      </span>
    </div>

    <h1 style="font-size:26px;font-weight:700;color:#fafaf9;margin:0 0 16px;line-height:1.2;text-align:center;font-family:Georgia,'Times New Roman',serif;">
      Your ${opts.streak}-day streak ends tonight
    </h1>
    
    <p style="font-size:15px;color:#a8a29e;line-height:1.7;margin:0 0 12px;text-align:center;">
      You've debated for <strong style="color:#fbbf24;">${opts.streak} days in a row</strong>. That's impressive dedication.
    </p>

    <p style="font-size:15px;color:#a8a29e;line-height:1.7;margin:0 0 28px;text-align:center;">
      If you don't debate before midnight UTC, your streak resets to zero.
    </p>

    <!-- Urgency bar -->
    <div style="background:linear-gradient(90deg,#f59e0b,#fbbf24);height:4px;border-radius:2px;margin-bottom:28px;"></div>

    <div style="text-align:center;">
      <a href="${BASE_URL}/debate" style="display:inline-block;background:linear-gradient(135deg,#f59e0b 0%,#fbbf24 100%);color:#0c0a09;font-size:15px;font-weight:700;padding:16px 32px;border-radius:12px;text-decoration:none;box-shadow:0 10px 40px -10px rgba(245,158,11,0.5);">
        Keep the Streak Alive →
      </a>
    </div>
  `;

  return {
    subject: `⚠️ Your ${opts.streak}-day streak expires in a few hours`,
    html: emailLayout(content, opts.unsubscribeToken),
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
