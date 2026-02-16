import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

// Load env vars
dotenv.config({ path: '.env.local' });

async function main() {
  // Import D1 after loading env vars
  const { d1 } = await import('../src/lib/d1');

  console.log("Fetching recent debates...");
  
  // Verify credentials
  if (!process.env.CLOUDFLARE_API_TOKEN) {
      console.error("\n❌ Missing CLOUDFLARE_API_TOKEN in environment.");
      console.error("Please ensure .env.local contains:");
      console.error("  CLOUDFLARE_ACCOUNT_ID=...");
      console.error("  CLOUDFLARE_D1_DATABASE_ID=...");
      console.error("  CLOUDFLARE_API_TOKEN=...");
      console.error("  CLOUDFLARE_EMAIL=...");
      console.error("\nAlternatively, run with: CLOUDFLARE_API_TOKEN=... npx tsx scripts/analyze_dropoff.ts\n");
      
      // Try to read manually if dotenv failed
      try {
          const envConfig = fs.readFileSync('.env.local', 'utf8');
          for (const line of envConfig.split('\n')) {
              const [key, val] = line.split('=');
              if (key && val) process.env[key.trim()] = val.trim();
          }
      } catch {
          console.error("Could not read .env.local");
      }
  }

  // Fetch 100 recent debates
  const result = await d1.query(
    `SELECT * FROM debates ORDER BY created_at DESC LIMIT 100`
  );

  if (!result.success || !result.result) {
    console.error("Failed to fetch debates:", result.error);
    return;
  }

  const debates = result.result;
  console.log(`Fetched ${debates.length} debates.`);

  const incompleteDebates = [];
  
  for (const debate of debates) {
    let messages: any[] = [];
    try {
      if (typeof debate.messages === 'string') {
        messages = JSON.parse(debate.messages);
      } else {
        messages = debate.messages as any[];
      }
    } catch {
      continue;
    }

    if (messages.length === 0) continue;
    
    const lastMsg = messages[messages.length - 1];
    
    // Incomplete criteria: Last message is AI and user hasn't replied.
    // Also check if the debate was "short" (e.g. < 6 messages)
    if (lastMsg.role === 'ai') {
      incompleteDebates.push({
        id: debate.id,
        topic: debate.topic,
        messageCount: messages.length,
        lastMessage: lastMsg.content,
        messages: messages,
        variant: (debate.score_data && typeof debate.score_data === 'string' ? JSON.parse(debate.score_data).promptVariant : 'unknown')
      });
    }
    
    if (incompleteDebates.length >= 20) break;
  }

  console.log(`Found ${incompleteDebates.length} incomplete debates.`);
  
  // Analyze patterns
  let report = `# Debate Drop-off Analysis\n\n`;
  report += `Analyzed ${debates.length} recent debates. Found ${incompleteDebates.length} incomplete ones (user stopped responding).\n\n`;
  
  report += `## Summary Statistics\n`;
  // Average length
  const avgLen = incompleteDebates.reduce((acc, d) => acc + d.messageCount, 0) / incompleteDebates.length;
  report += `- Average messages before drop-off: ${avgLen.toFixed(1)}\n`;
  
  // Common drop-off points
  const dropOffPoints: Record<number, number> = {};
  incompleteDebates.forEach(d => {
      dropOffPoints[d.messageCount] = (dropOffPoints[d.messageCount] || 0) + 1;
  });
  report += `- Drop-off points: ${JSON.stringify(dropOffPoints)}\n\n`;

  report += `## Detailed Logs\n\n`;

  for (const d of incompleteDebates) {
      report += `### Debate ${d.id} (${d.topic})\n`;
      report += `- Messages: ${d.messageCount}\n`;
      report += `- Variant: ${d.variant}\n`;
      report += `- Last AI Message: "${d.lastMessage}"\n`;
      
      // Check previous user message
      if (d.messages.length > 1) {
          const prevUser = d.messages[d.messages.length - 2];
          report += `- Previous User Argument: "${prevUser.content.substring(0, 100)}..."\n`;
      }
      report += `\n`;
  }
  
  const reportPath = path.join(process.cwd(), 'reports/dropoff_analysis.md');
  // Ensure reports dir exists
  const reportsDir = path.dirname(reportPath);
  if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
  }

  fs.writeFileSync(reportPath, report);
  console.log(`Report saved to ${reportPath}`);
}

main().catch(console.error);
