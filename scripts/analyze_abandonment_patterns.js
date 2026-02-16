#!/usr/bin/env node
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const DATABASE_ID = process.env.CLOUDFLARE_D1_DATABASE_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

async function analyzeAbandonment() {
  if (!ACCOUNT_ID || !DATABASE_ID || !API_TOKEN) {
    console.warn('⚠️  Missing D1 credentials.');
    process.exit(1);
  }

  console.log('🔍 Fetching recent debate messages...');

  // Fetch debates from last 7 days
  const sql = `
    SELECT 
      messages
    FROM debates 
    WHERE created_at > datetime('now', '-7 days')
    LIMIT 200;
  `;

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({ sql, params: [] }),
      }
    );

    const data = await response.json();

    if (data.success && data.result?.[0]?.results) {
      const rows = data.result[0].results;
      console.log(`✅ Analyzed ${rows.length} debates.`);
      
      const lastMessages = [];

      for (const row of rows) {
        let msgs = [];
        try {
          msgs = typeof row.messages === 'string' ? JSON.parse(row.messages) : row.messages;
        } catch {
          continue;
        }

        if (!Array.isArray(msgs) || msgs.length === 0) continue;

        // "Abandonment" implies the conversation stopped. 
        // We look at the very last message.
        const lastMsg = msgs[msgs.length - 1];
        
        // We care about the content and who sent it (role).
        // Assuming structure: { role: 'assistant'|'user', content: '...' }
        if (lastMsg && lastMsg.content) {
            lastMessages.push({
                role: lastMsg.role,
                content: lastMsg.content,
                length: msgs.length
            });
        }
      }

      // Group by content (naive exact match or first 50 chars)
      const counts = {};
      lastMessages.forEach(m => {
          const key = `[${m.role}] ${m.content.substring(0, 100).replace(/\n/g, ' ')}`;
          counts[key] = (counts[key] || 0) + 1;
      });

      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      
      console.log('\n📊 Top 5 Last Messages before Abandonment:');
      sorted.slice(0, 5).forEach(([msg, count], i) => {
          console.log(`${i+1}. (${count}x) ${msg}`);
      });

      // Also generate a markdown report
      let md = `# Debate Abandonment Analysis\n\nGenerated on: ${new Date().toISOString()}\n\n`;
      md += `Analyzed ${rows.length} recent debates.\n\n## Top Patterns\n\n`;
      sorted.slice(0, 10).forEach(([msg, count]) => {
          md += `- **${count} occurrences**: \`${msg}\`\n`;
      });

      fs.writeFileSync(join(__dirname, '..', 'abandonment_report.md'), md);
      console.log('\n📄 Report saved to abandonment_report.md');

    } else {
      console.error('❌ Query failed:', data.errors || data.error);
    }
  } catch (error) {
    console.error('❌ Error executing query:', error);
  }
}

analyzeAbandonment();
