/**
 * Email templates — table-based HTML for maximum email client compatibility.
 *
 * All templates include:
 * - Unsubscribe link (CAN-SPAM compliant)
 * - Table-based layouts (no flexbox/grid)
 * - Inline styles only (no CSS variables)
 * - Mobile-responsive design
 */

import { getUnsubscribeUrl, getDebateUrl } from './email';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://debateai.org';

/* ------------------------------------------------------------------ */
/*  Shared layout                                                      */
/* ------------------------------------------------------------------ */

function emailLayout(content: string, unsubscribeToken: string): string {
  const unsubscribeUrl = getUnsubscribeUrl(unsubscribeToken);
  const preferencesUrl = `${BASE_URL}/settings/email`;

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DebateAI</title>
</head>
<body style="margin:0;padding:0;background-color:#fafaf9;">
  <!-- Wrapper table -->
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#fafaf9;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <!-- Main container -->
        <table border="0" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;">
          
          <!-- Logo header -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <table border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:12px;">
                    <a href="${BASE_URL}" style="text-decoration:none;">
                      <span style="font-size:28px;font-weight:700;color:#1c1917;letter-spacing:-0.02em;font-family:Georgia,'Times New Roman',serif;">DebateAI</span>
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <table border="0" cellpadding="0" cellspacing="0" width="48" style="width:48px;">
                      <tr><td height="3" style="background-color:#b54d30;font-size:0;line-height:0;">&nbsp;</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content card -->
          <tr>
            <td style="background-color:#ffffff;border:1px solid #e7e5e4;border-radius:16px;padding:48px 40px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:32px;">
              <table border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom:8px;">
                    <p style="font-size:13px;color:#78716c;line-height:1.6;margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                      <a href="${preferencesUrl}" style="color:#b54d30;text-decoration:underline;">Email preferences</a>
                      <span style="color:#e7e5e4;margin:0 8px;">·</span>
                      <a href="${unsubscribeUrl}" style="color:#b54d30;text-decoration:underline;">Unsubscribe</a>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:4px;">
                    <p style="font-size:12px;color:#78716c;margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                      DebateAI · Challenge your convictions
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
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
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
      <tr>
        <td align="center">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td style="background-color:#f9ebe6;border:1px solid #d98970;border-radius:100px;padding:8px 16px;">
                <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#b54d30;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                  ${emoji} Today's Debate
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Topic heading -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
      <tr>
        <td align="center">
          <h1 style="font-size:32px;font-weight:700;color:#1c1917;margin:0;line-height:1.2;font-family:Georgia,'Times New Roman',serif;letter-spacing:-0.01em;">
            ${escapeHtml(opts.topic)}
          </h1>
        </td>
      </tr>
    </table>

    <!-- Divider -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
      <tr>
        <td align="center">
          <table border="0" cellpadding="0" cellspacing="0" width="60">
            <tr><td height="2" style="background-color:#b54d30;font-size:0;line-height:0;">&nbsp;</td></tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Opponent info -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:32px;">
      <tr>
        <td style="background-color:#f9ebe6;border:1px solid #d98970;border-radius:12px;padding:16px 20px;">
          <p style="font-size:14px;color:#1c1917;margin:0;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            You're debating <span style="color:#b54d30;font-weight:600;">${escapeHtml(opts.persona)}</span>
          </p>
        </td>
      </tr>
    </table>

    <!-- CTA Button -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
      <tr>
        <td align="center">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="background-color:#b54d30;border-radius:12px;">
                <a href="${debateUrl}" style="display:block;color:#ffffff;font-size:15px;font-weight:600;padding:16px 32px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                  Start Debating →
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Teaser text -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center">
          <p style="font-size:14px;color:#78716c;line-height:1.6;margin:0;font-style:italic;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            Think you can win? The AI won't go easy on you.
          </p>
        </td>
      </tr>
    </table>
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
    <!-- Icon header -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
      <tr>
        <td align="center">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="background-color:#f9ebe6;border:2px solid #b54d30;border-radius:16px;padding:20px;width:64px;height:64px;">
                <span style="font-size:32px;">🎯</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Heading -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:16px;">
      <tr>
        <td align="center">
          <h1 style="font-size:32px;font-weight:700;color:#1c1917;margin:0;line-height:1.2;font-family:Georgia,'Times New Roman',serif;">
            ${greeting}, you're in.
          </h1>
        </td>
      </tr>
    </table>

    <!-- Description -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:32px;">
      <tr>
        <td align="center">
          <p style="font-size:16px;color:#78716c;line-height:1.7;margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            Every morning at 9am, we'll send you a fresh debate topic with an AI opponent ready to fight.
            No prep needed — just show up with an opinion.
          </p>
        </td>
      </tr>
    </table>

    <!-- Feature highlights -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:32px;">
      <tr>
        <td style="background-color:#f9ebe6;border:1px solid #d98970;border-radius:12px;padding:24px;">
          
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:16px;">
            <tr>
              <td width="36" style="padding-right:12px;"><span style="font-size:20px;">🧠</span></td>
              <td><span style="font-size:15px;color:#1c1917;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">AI opponents that research & cite real sources</span></td>
            </tr>
          </table>

          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:16px;">
            <tr>
              <td width="36" style="padding-right:12px;"><span style="font-size:20px;">📊</span></td>
              <td><span style="font-size:15px;color:#1c1917;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Detailed scoring and performance tracking</span></td>
            </tr>
          </table>

          <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td width="36" style="padding-right:12px;"><span style="font-size:20px;">🔥</span></td>
              <td><span style="font-size:15px;color:#1c1917;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Daily streaks to keep you sharp</span></td>
            </tr>
          </table>

        </td>
      </tr>
    </table>

    <!-- CTA Button -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
      <tr>
        <td align="center">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="background-color:#b54d30;border-radius:12px;">
                <a href="${BASE_URL}/debate" style="display:block;color:#ffffff;font-size:15px;font-weight:600;padding:16px 32px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                  Start Your First Debate
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Footer text -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center">
          <p style="font-size:13px;color:#78716c;line-height:1.6;margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            You'll also get weekly recaps of your debate stats and notifications when someone challenges your debates.
          </p>
        </td>
      </tr>
    </table>
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
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding:20px 0;">
          
          <table border="0" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr>
              <td align="center" style="background-color:#f9ebe6;border:2px solid #b54d30;border-radius:16px;padding:20px;width:64px;height:64px;">
                <span style="font-size:32px;">👋</span>
              </td>
            </tr>
          </table>

          <h1 style="font-size:28px;font-weight:700;color:#1c1917;margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;">
            You've been unsubscribed
          </h1>

          <p style="font-size:15px;color:#78716c;line-height:1.7;margin:0 0 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            You won't receive any more emails from DebateAI.<br />
            Changed your mind? You can always re-subscribe.
          </p>

          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="background-color:transparent;border:2px solid #b54d30;border-radius:10px;">
                <a href="${resubscribeUrl}" style="display:block;color:#b54d30;font-size:14px;font-weight:600;padding:12px 24px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                  Re-subscribe →
                </a>
              </td>
            </tr>
          </table>

        </td>
      </tr>
    </table>
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
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:8px;">
        <tr>
          <td align="center" style="font-size:48px;padding-bottom:8px;">😴</td>
        </tr>
      </table>

      <h1 style="font-size:28px;font-weight:700;color:#1c1917;margin:0 0 16px;text-align:center;font-family:Georgia,'Times New Roman',serif;">
        You took the week off.
      </h1>

      <p style="font-size:15px;color:#78716c;line-height:1.7;margin:0 0 28px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        It's been preparing new arguments. Ready to test them?
      </p>
    `;
  } else {
    content = `
      <!-- Badge -->
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:8px;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background-color:#f9ebe6;border:1px solid #d98970;border-radius:100px;padding:8px 16px;">
                  <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#b54d30;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                    📊 Weekly Recap
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <h1 style="font-size:28px;font-weight:700;color:#1c1917;margin:0 0 28px;text-align:center;font-family:Georgia,'Times New Roman',serif;">
        Your week on DebateAI
      </h1>

      <!-- Stats grid (2 columns using tables) -->
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
        <tr>
          <td width="50%" style="padding-right:6px;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="background-color:#f9ebe6;border:1px solid #d98970;border-radius:12px;padding:20px;text-align:center;">
                  <div style="font-size:32px;font-weight:700;color:#b54d30;margin-bottom:4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${stats.totalDebates}</div>
                  <div style="font-size:12px;color:#78716c;text-transform:uppercase;letter-spacing:0.05em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Debates</div>
                </td>
              </tr>
            </table>
          </td>
          <td width="50%" style="padding-left:6px;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="background-color:#f9ebe6;border:1px solid #d98970;border-radius:12px;padding:20px;text-align:center;">
                  <div style="font-size:32px;font-weight:700;color:#b54d30;margin-bottom:4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${stats.streakCount}</div>
                  <div style="font-size:12px;color:#78716c;text-transform:uppercase;letter-spacing:0.05em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Day Streak</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      ${stats.bestScore > 0 ? `
      <!-- Best Performance -->
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
        <tr>
          <td style="background-color:#f9ebe6;border:1px solid #d98970;border-radius:12px;padding:20px;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:8px;">
              <tr>
                <td>
                  <span style="font-size:20px;margin-right:8px;">🏆</span>
                  <span style="font-size:13px;font-weight:600;color:#b54d30;text-transform:uppercase;letter-spacing:0.05em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Best Performance</span>
                </td>
              </tr>
            </table>
            <div style="font-size:24px;font-weight:700;color:#1c1917;margin-bottom:4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${stats.bestScore}%</div>
            <div style="font-size:14px;color:#78716c;font-style:italic;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">"${escapeHtml(stats.bestTopic)}"</div>
          </td>
        </tr>
      </table>
      ` : ''}
    `;
  }

  content += `
    <!-- Trending topic -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:28px;">
      <tr>
        <td style="background-color:#f9ebe6;border:1px solid #d98970;border-radius:12px;padding:20px;">
          <p style="font-size:12px;font-weight:600;color:#78716c;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            🔥 Trending this week
          </p>
          <p style="font-size:16px;color:#1c1917;font-weight:600;margin:0;line-height:1.4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            "${escapeHtml(trendingTopic)}"
          </p>
        </td>
      </tr>
    </table>

    <!-- CTA Button -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="background-color:#b54d30;border-radius:12px;">
                <a href="${BASE_URL}/debate" style="display:block;color:#ffffff;font-size:15px;font-weight:600;padding:16px 32px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                  Jump Back In →
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
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
    <!-- Icon -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:20px;">
      <tr>
        <td align="center">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="background-color:#f9ebe6;border:2px solid #b54d30;border-radius:16px;padding:20px;width:64px;height:64px;">
                <span style="font-size:28px;">⚔️</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Heading -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:16px;">
      <tr>
        <td align="center">
          <h1 style="font-size:28px;font-weight:700;color:#1c1917;margin:0;line-height:1.3;font-family:Georgia,'Times New Roman',serif;">
            Someone challenged your position
          </h1>
        </td>
      </tr>
    </table>

    <p style="font-size:15px;color:#78716c;line-height:1.7;margin:0 0 24px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      Another debater took the opposite side on <strong style="color:#1c1917;">"${escapeHtml(opts.topic)}"</strong>
    </p>

    <!-- Score comparison -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
      <tr>
        <td style="background-color:#f9ebe6;border:1px solid #d98970;border-radius:16px;padding:24px;">
          
          <!-- Scores row -->
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:16px;">
            <tr>
              <td align="center">
                <table border="0" cellpadding="0" cellspacing="0">
                  <tr>
                    <!-- Your score -->
                    <td align="center" style="padding-right:20px;">
                      <div style="font-size:36px;font-weight:700;color:${won ? '#4A7C59' : '#b54d30'};margin-bottom:4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${opts.userScore}</div>
                      <div style="font-size:12px;color:#78716c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Your Score</div>
                    </td>

                    <!-- VS -->
                    <td align="center" style="padding:0 20px;">
                      <div style="font-size:14px;font-weight:700;color:#9B8A6E;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">VS</div>
                    </td>

                    <!-- Their score -->
                    <td align="center" style="padding-left:20px;">
                      <div style="font-size:36px;font-weight:700;color:${!won && !tied ? '#C44B3F' : '#b54d30'};margin-bottom:4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${opts.opponentScore}</div>
                      <div style="font-size:12px;color:#78716c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Their Score</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- Status -->
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-top:1px solid #d98970;">
            <tr>
              <td align="center" style="padding-top:16px;">
                <span style="font-size:14px;font-weight:600;color:${won ? '#4A7C59' : tied ? '#b54d30' : '#C44B3F'};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                  ${won ? '👑 You\'re winning!' : tied ? '🤝 It\'s a tie!' : '💪 They\'re ahead'}
                </span>
              </td>
            </tr>
          </table>

        </td>
      </tr>
    </table>

    <p style="font-size:14px;color:#78716c;line-height:1.6;margin:0 0 24px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      Think you can beat both the AI <em>and</em> their score?
    </p>

    <!-- CTA Button -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="background-color:#b54d30;border-radius:12px;">
                <a href="${getDebateUrl(opts.topic)}" style="display:block;color:#ffffff;font-size:15px;font-weight:600;padding:16px 32px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                  Defend Your Position →
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
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
    <!-- Icon -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:20px;">
      <tr>
        <td align="center">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="background-color:#f9ebe6;border:2px solid #b54d30;border-radius:16px;padding:20px;width:64px;height:64px;">
                <span style="font-size:28px;">🔥</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Heading -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:16px;">
      <tr>
        <td align="center">
          <h1 style="font-size:28px;font-weight:700;color:#1c1917;margin:0;line-height:1.3;font-family:Georgia,'Times New Roman',serif;">
            The debate everyone's talking about
          </h1>
        </td>
      </tr>
    </table>

    <!-- Topic card -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
      <tr>
        <td style="background-color:#f9ebe6;border:1px solid #d98970;border-radius:16px;padding:24px;">
          
          <p style="font-size:18px;color:#1c1917;font-weight:600;margin:0 0 16px;line-height:1.4;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            "${escapeHtml(opts.trendingTopic)}"
          </p>

          <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td align="center">
                <table border="0" cellpadding="0" cellspacing="0">
                  <tr>
                    <!-- Debates -->
                    <td align="center" style="padding-right:24px;">
                      <div style="font-size:24px;font-weight:700;color:#b54d30;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${opts.count}</div>
                      <div style="font-size:11px;color:#78716c;text-transform:uppercase;letter-spacing:0.05em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Debates</div>
                    </td>

                    <!-- Divider -->
                    <td style="border-left:1px solid #d98970;">&nbsp;</td>

                    <!-- AI Win Rate -->
                    <td align="center" style="padding-left:24px;">
                      <div style="font-size:24px;font-weight:700;color:#b54d30;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${opts.aiWinPct}%</div>
                      <div style="font-size:11px;color:#78716c;text-transform:uppercase;letter-spacing:0.05em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">AI Win Rate</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

        </td>
      </tr>
    </table>

    <p style="font-size:15px;color:#78716c;line-height:1.7;margin:0 0 28px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      You've been quiet. The AI hasn't.
    </p>

    <!-- CTA Button -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="background-color:#b54d30;border-radius:12px;">
                <a href="${getDebateUrl(opts.trendingTopic)}" style="display:block;color:#ffffff;font-size:15px;font-weight:600;padding:16px 32px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                  See What You're Missing →
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
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
    <!-- Fire icon -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:20px;">
      <tr>
        <td align="center">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="background-color:#f9ebe6;border:2px solid #b54d30;border-radius:16px;padding:24px;width:64px;height:64px;">
                <span style="font-size:32px;">🔥</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Urgency badge -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:16px;">
      <tr>
        <td align="center">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td style="background-color:#f9ebe6;border:1px solid #d98970;border-radius:100px;padding:8px 16px;">
                <span style="font-size:12px;font-weight:700;color:#b54d30;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                  ⚠️ Streak Expires Soon
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Heading -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:16px;">
      <tr>
        <td align="center">
          <h1 style="font-size:28px;font-weight:700;color:#1c1917;margin:0;line-height:1.2;font-family:Georgia,'Times New Roman',serif;">
            Your ${opts.streak}-day streak ends tonight
          </h1>
        </td>
      </tr>
    </table>

    <p style="font-size:15px;color:#78716c;line-height:1.7;margin:0 0 12px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      You've debated for <strong style="color:#b54d30;">${opts.streak} days in a row</strong>. That's impressive dedication.
    </p>

    <p style="font-size:15px;color:#78716c;line-height:1.7;margin:0 0 28px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      If you don't debate before midnight UTC, your streak resets to zero.
    </p>

    <!-- Progress bar -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:28px;">
      <tr>
        <td style="background-color:#b54d30;height:4px;border-radius:2px;font-size:0;line-height:0;">&nbsp;</td>
      </tr>
    </table>

    <!-- CTA Button -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="background-color:#b54d30;border-radius:12px;">
                <a href="${BASE_URL}/debate" style="display:block;color:#ffffff;font-size:15px;font-weight:600;padding:16px 32px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                  Keep the Streak Alive →
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
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
