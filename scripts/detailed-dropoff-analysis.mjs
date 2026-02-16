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
const DATABASE_ID = process.env.CLOUDFLARE_D1_DATABASE_ID || '28578b68-25d4-447b-aaf3-4fa3cc01a99b';
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

async function detailedAnalysis() {
  if (!ACCOUNT_ID || !API_TOKEN) {
    console.error('⚠️  Missing CLOUDFLARE credentials (ACCOUNT_ID, API_TOKEN).');
    process.exit(1);
  }

  console.log('🔍 Detailed Drop-off Analysis (Last 200 Incomplete)...');

  // Query: Get last 200 likely incomplete debates
  const sql = `
    SELECT 
      id,
      topic,
      messages,
      score_data,
      created_at
    FROM debates
    WHERE (score_data IS NULL OR score_data = '{}')
      AND user_id != 'test-user-123'
    ORDER BY created_at DESC
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
    if (!data.success || !data.result?.[0]?.results) {
      console.error('❌ Query failed:', data.errors || data.error);
      return;
    }

    const rows = data.result[0].results;
    console.log(`📊 Retrieved ${rows.length} incomplete debates.`);

    let errorCount = 0;
    let stalledCount = 0; // User sent last message, no AI reply?
    let userAbandonedCount = 0; // AI sent last message, user left?

    const errorPatterns = [/error/i, /timeout/i, /failed/i, /exception/i, /500/];
    
    const analysisRows = [];

    rows.forEach(r => {
      let msgs = [];
      try {
        msgs = JSON.parse(r.messages || '[]');
      } catch {
        console.warn(`Failed to parse messages for ${r.id}`);
      }

      const msgCount = msgs.length;
      if (msgCount === 0) return; // Ignore empty

      const lastMsg = msgs[msgCount - 1];
      const lastRole = lastMsg.role || (lastMsg.isUser ? 'user' : 'ai'); // Adjust based on message structure
      const lastContent = lastMsg.content || '';

      // Check for explicit errors
      const hasError = errorPatterns.some(p => p.test(lastContent));
      if (hasError) errorCount++;

      // Check abandonment pattern
      if (lastRole === 'user') {
        stalledCount++; // User spoke, AI didn't reply (or reply not saved)
      } else {
        userAbandonedCount++; // AI spoke, user left
      }

      analysisRows.push({
        id: r.id,
        topic: r.topic,
        created_at: r.created_at,
        msg_count: msgCount,
        last_role: lastRole,
        has_error: hasError,
        last_content_preview: lastContent.substring(0, 50).replace(/\n/g, ' ')
      });
    });

    console.log(`\n📉 Findings from ${rows.length} records:`);
    console.log(`- Stalled (User waiting): ${stalledCount} (${(stalledCount/rows.length*100).toFixed(1)}%)`);
    console.log(`- Abandoned (User left): ${userAbandonedCount} (${(userAbandonedCount/rows.length*100).toFixed(1)}%)`);
    console.log(`- Explicit Errors in text: ${errorCount}`);

    // Export
    const csvPath = join(__dirname, '..', 'detailed_dropoff_analysis.csv');
    const headers = 'id,topic,created_at,msg_count,last_role,has_error,last_content_preview';
    const csvContent = analysisRows.map(r => 
      `${r.id},"${r.topic.replace(/"/g, '""')}",${r.created_at},${r.msg_count},${r.last_role},${r.has_error},"${r.last_content_preview.replace(/"/g, '""')}"`
    ).join('\n');
    
    fs.writeFileSync(csvPath, headers + '\n' + csvContent);
    console.log(`\n📄 Detailed report saved to: ${csvPath}`);

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

detailedAnalysis();
