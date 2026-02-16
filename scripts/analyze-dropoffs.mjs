#!/usr/bin/env node
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const DATABASE_ID = process.env.CLOUDFLARE_D1_DATABASE_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

async function analyzeDropoffs() {
  if (!ACCOUNT_ID || !DATABASE_ID || !API_TOKEN) {
    console.warn('⚠️  Missing D1 credentials. Cannot run live analysis.');
    console.log('To run this script locally:');
    console.log('1. Get CLOUDFLARE_* credentials from 1Password/Vercel');
    console.log('2. Create .env.local in project root');
    console.log('3. Run: node scripts/analyze-dropoffs.mjs');
    process.exit(0);
  }

  console.log('🔍 Analyzing debate drop-offs (Last 48 hours)...');

  // Query: Get all debates from last 48h
  const sql = `
    SELECT 
      id,
      topic,
      created_at,
      json_array_length(messages) as msg_count,
      score_data,
      user_score
    FROM debates
    WHERE created_at > datetime('now', '-48 hours')
      AND user_id != 'test-user-123'
    ORDER BY created_at DESC;
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
      const total = rows.length;
      
      console.log(`\n📊 Total Debates (48h): ${total}`);

      // Analysis buckets
      let completed = 0;
      let msgCountDist = {};
      let zeroOrOne = 0;
      let twoToFour = 0;
      let fivePlus = 0;

      rows.forEach(r => {
        // Check completion
        let isCompleted = false;
        if (r.score_data) {
          try {
            const sd = JSON.parse(r.score_data);
            if (sd.debateScore) isCompleted = true;
          } catch {}
        }
        
        if (isCompleted) completed++;

        // Message count distribution
        const count = r.msg_count || 0;
        msgCountDist[count] = (msgCountDist[count] || 0) + 1;

        if (count < 2) zeroOrOne++;
        else if (count <= 4) twoToFour++;
        else fivePlus++;
      });

      const completionRate = total > 0 ? (completed / total * 100).toFixed(1) : 0;
      
      console.log(`✅ Completed: ${completed} (${completionRate}%)`);
      console.log(`❌ Incomplete: ${total - completed}`);
      
      console.log('\n📉 Message Count Distribution (Incomplete):');
      Object.keys(msgCountDist).sort((a,b) => Number(a)-Number(b)).forEach(k => {
        console.log(`   ${k} messages: ${msgCountDist[k]}`);
      });

      console.log('\n🧠 Interpretations:');
      if (zeroOrOne > 0) console.log(`- ${zeroOrOne} debates have < 2 messages. These are likely failed creations or immediate bounces.`);
      if (twoToFour > 0) console.log(`- ${twoToFour} debates have 2-4 messages. Users start but stop quickly.`);
      if (fivePlus > 0) console.log(`- ${fivePlus} debates have 5+ messages but NO score. Potential UX issue (can't find finish button?) or scoring error.`);

      // Export to CSV for further review
      const csvPath = join(__dirname, '..', 'dropoff_analysis.csv');
      const csvRows = rows.map(r => `${r.id},"${r.topic.replace(/"/g, '""')}",${r.created_at},${r.msg_count},${!!r.score_data}`).join('\n');
      fs.writeFileSync(csvPath, 'id,topic,created_at,msg_count,is_scored\n' + csvRows);
      console.log(`\n📄 Detailed log exported to: ${csvPath}`);

    } else {
      console.error('❌ Query failed:', data.errors || data.error);
    }
  } catch (error) {
    console.error('❌ Error executing query:', error);
  }
}

analyzeDropoffs();
