import 'dotenv/config';
import { it } from 'vitest';
import { d1 } from '../src/lib/d1';

// Mock Fetch for D1 Client
if (!(global as any).fetch) {
  (global as any).fetch = require('node-fetch');
}

it('Email Notification System Audit', async () => {
  console.log('--- Email Notification System Audit ---');

  try {
    // 1. Check if tables exist
    const tables = await d1.query("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('email_preferences', 'user_streaks', 'users')");
    console.log('\n[1] Database Tables:', tables.result?.map((r: any) => r.name).join(', ') || 'NONE');

    // 2. Subscriber Counts
    const subs = await d1.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN daily_digest = 1 THEN 1 ELSE 0 END) as daily,
        SUM(CASE WHEN weekly_recap = 1 THEN 1 ELSE 0 END) as weekly,
        SUM(CASE WHEN challenge_notify = 1 THEN 1 ELSE 0 END) as challenge,
        SUM(CASE WHEN unsubscribed_at IS NOT NULL THEN 1 ELSE 0 END) as unsubscribed
      FROM email_preferences
    `);
    console.log('\n[2] Subscriber Stats:', subs.result?.[0]);

    // 3. Streak Warning Candidates
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const streakWarnings = await d1.query(
      'SELECT COUNT(*) as count FROM user_streaks WHERE last_debate_date = ? AND current_streak >= 2',
      [yesterday]
    );
    console.log(`\n[3] Streak Warning Candidates (debated yesterday [${yesterday}], streak >= 2):`, streakWarnings.result?.[0]?.count);

    // 4. Win-back Candidates (Inactive 7-8 days)
    const winBack = await d1.query(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM debates
      GROUP BY user_id
      HAVING MAX(created_at) BETWEEN date('now', '-8 days') AND date('now', '-7 days')
    `);
    console.log('[4] Win-back Candidates (last active 7-8 days ago):', winBack.result?.[0]?.count || 0);

    // 5. Recent Activity (for challenge/recap)
    const recentDebates = await d1.query("SELECT COUNT(*) as count FROM debates WHERE created_at >= date('now', '-7 days')");
    console.log('[5] Debates in last 7 days:', recentDebates.result?.[0]?.count);
  } catch (err) {
    console.error('Audit Error:', err);
  }

  console.log('\n--- Audit Complete ---');
}, 30000);
