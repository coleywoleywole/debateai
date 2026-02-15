import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { performance } from 'perf_hooks';

// Load env vars
dotenv.config({ path: '.env.local' });

async function main() {
  console.log("Starting Backend Performance Audit...");
  
  // Import D1
  const { d1 } = await import('../src/lib/d1');

  // Verify credentials
  if (!process.env.CLOUDFLARE_API_TOKEN) {
      console.error("❌ Missing CLOUDFLARE_API_TOKEN. Cannot audit production DB.");
      process.exit(1);
  }

  // Ensure tables exist
  console.log("Ensuring schema...");
  await d1.createTables();

  const reportPath = path.join(process.cwd(), `reports/backend_performance_${new Date().toISOString().split('T')[0].replace(/-/g, '_')}.md`);
  const reportsDir = path.dirname(reportPath);
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  let report = `# Backend Performance Audit - ${new Date().toISOString().split('T')[0]}\n\n`;
  report += `## Database Latency (D1)\n\n`;

  // 1. Measure List Debates Latency
  console.log("Measuring List Debates Latency...");
  const startList = performance.now();
  const listResult = await d1.getAllRecentDebates(100);
  const endList = performance.now();
  const listTime = endList - startList;
  
  if (!listResult.success) {
      console.error("Failed to list debates:", listResult.error);
      report += `❌ **List Debates (100 rows)**: Failed (${listResult.error})\n`;
  } else {
      console.log(`List Debates (100 rows): ${listTime.toFixed(2)}ms`);
      report += `✅ **List Debates (100 rows)**: ${listTime.toFixed(2)}ms\n`;
  }

  // 2. Measure Single Debate Fetch Latency (Avg of 10)
  let sampleId = '';
  if (listResult.success && listResult.result && listResult.result.length > 0) {
      sampleId = (listResult.result[0] as any).id;
      console.log(`Measuring Single Fetch Latency (ID: ${sampleId})...`);
      
      let totalTime = 0;
      const iterations = 10;
      
      for (let i = 0; i < iterations; i++) {
          const start = performance.now();
          await d1.getDebate(sampleId);
          totalTime += (performance.now() - start);
      }
      
      const avgTime = totalTime / iterations;
      console.log(`Avg Single Fetch: ${avgTime.toFixed(2)}ms`);
      report += `✅ **Get Single Debate (Avg 10)**: ${avgTime.toFixed(2)}ms\n`;
  }

  // 3. Measure Vote Counts Latency
  if (sampleId) {
      console.log(`Measuring Vote Counts Latency...`);
      const startVote = performance.now();
      await d1.getVoteCounts(sampleId);
      const endVote = performance.now();
      const voteTime = endVote - startVote;
      console.log(`Get Vote Counts: ${voteTime.toFixed(2)}ms`);
      report += `✅ **Get Vote Counts**: ${voteTime.toFixed(2)}ms\n`;
  }

  // 4. Measure Leaderboard Latency
  console.log(`Measuring Leaderboard Latency...`);
  const startLeaderboard = performance.now();
  await d1.getLeaderboard(10);
  const endLeaderboard = performance.now();
  const leaderboardTime = endLeaderboard - startLeaderboard;
  console.log(`Get Leaderboard: ${leaderboardTime.toFixed(2)}ms`);
  report += `✅ **Get Leaderboard (Top 10)**: ${leaderboardTime.toFixed(2)}ms\n`;

  report += `\n## Stalled Debates Investigation\n\n`;
  report += `Checking for debates where the user sent the last message but AI did not respond (potential backend timeout/crash).\n\n`;

  // 3. Check for Stalled Debates
  // Fetch full details for recent debates
  const fullDebatesResult = await d1.query(`SELECT * FROM debates ORDER BY created_at DESC LIMIT 50`);
  
  let stalledCount = 0;
  const stalledDebates = [];

  if (fullDebatesResult.success && fullDebatesResult.result) {
      for (const debate of fullDebatesResult.result as any[]) {
          let messages = [];
          try {
              messages = JSON.parse(debate.messages);
          } catch (e) { continue; }

          if (messages.length === 0) continue;

          const lastMsg = messages[messages.length - 1];
          const createdAt = new Date(debate.created_at).getTime();
          const now = Date.now();
          const ageSeconds = (now - createdAt) / 1000;

          // If last message is USER and debate is > 1 minute old, it's likely stalled
          if (lastMsg.role === 'user' && ageSeconds > 60) {
              stalledCount++;
              stalledDebates.push({
                  id: debate.id,
                  topic: debate.topic,
                  lastMsg: lastMsg.content,
                  msgCount: messages.length,
                  age: ageSeconds
              });
          }
      }
  }

  report += `**Found ${stalledCount} stalled debates in the last 50.**\n\n`;
  
  if (stalledCount > 0) {
      report += `| ID | Topic | Messages | Age (s) |\n|---|---|---|---|\n`;
      stalledDebates.forEach(d => {
          report += `| ${d.id} | ${d.topic} | ${d.msgCount} | ${d.age.toFixed(0)} |\n`;
      });
      report += `\n### Root Cause Hypothesis\n`;
      report += `- **High Latency**: AI model taking too long (> 60s)?\n`;
      report += `- **Vercel Timeout**: Serverless function timing out (limit is usually 10s-60s)?\n`;
      report += `- **Error**: Crash before saving AI response?\n`;
  } else {
      report += `✅ No stalled debates found in recent history. Backend seems to be responding.\n`;
  }

  fs.writeFileSync(reportPath, report);
  console.log(`Audit complete. Report saved to ${reportPath}`);
}

main().catch(console.error);
