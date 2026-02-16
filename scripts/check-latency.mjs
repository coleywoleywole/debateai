#!/usr/bin/env node
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const DATABASE_ID = process.env.CLOUDFLARE_D1_DATABASE_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

if (!ACCOUNT_ID || !DATABASE_ID || !API_TOKEN) {
  console.error('Missing Cloudflare credentials in .env.local');
  process.exit(1);
}

async function queryD1(sql, params = []) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_TOKEN}`,
      },
      body: JSON.stringify({ sql, params }),
    }
  );
  
  const data = await response.json();
  if (!data.success) {
    throw new Error(JSON.stringify(data.errors || data.error));
  }
  return data.result[0].results;
}

async function main() {
  console.log('Analyzing debate latency and errors (last 24h)...\n');
  
  try {
    const debates = await queryD1(`
      SELECT id, created_at, messages
      FROM debates
      WHERE created_at > datetime('now', '-1 day')
      ORDER BY created_at DESC
      LIMIT 100
    `);

    console.log(`Found ${debates.length} debates.\n`);

    const latencies = [];
    let noMessageCount = 0;
    let singleMessageCount = 0; // Likely AI failed to respond
    let errorCount = 0;

    debates.forEach(debate => {
      let messages = [];
      try {
        messages = typeof debate.messages === 'string' 
          ? JSON.parse(debate.messages) 
          : debate.messages;
      } catch {
        console.error(`Failed to parse messages for debate ${debate.id}`);
        errorCount++;
        return;
      }

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        noMessageCount++;
        return;
      }

      if (messages.length === 1) {
        singleMessageCount++;
      }

      // Calculate time to first AI response
      // Assuming messages[0] is user, messages[1] is AI
      if (messages.length >= 2) {
        const userMsg = messages[0];
        const aiMsg = messages[1];
        
        if (userMsg.created_at && aiMsg.created_at) {
          const t1 = new Date(userMsg.created_at).getTime();
          const t2 = new Date(aiMsg.created_at).getTime();
          const diff = t2 - t1;
          
          if (diff > 0 && diff < 600000) { // < 10 mins sanity check
            latencies.push(diff);
          }
        }
      }
    });

    if (latencies.length > 0) {
      const sum = latencies.reduce((a, b) => a + b, 0);
      const avg = sum / latencies.length;
      latencies.sort((a, b) => a - b);
      const p95 = latencies[Math.floor(latencies.length * 0.95)];
      
      console.log('--- Latency Stats (Time to First AI Response) ---');
      console.log(`Average: ${Math.round(avg)}ms`);
      console.log(`P95: ${Math.round(p95)}ms`);
      console.log(`Sample size: ${latencies.length} debates\n`);
    } else {
      console.log('No valid latency data found (no debates with >= 2 messages).\n');
    }

    console.log('--- Error / Drop-off Stats ---');
    console.log(`Debates with 0 messages: ${noMessageCount}`);
    console.log(`Debates with only 1 message (AI failed?): ${singleMessageCount}`);
    console.log(`Parse errors: ${errorCount}`);
    
  } catch (error) {
    console.error('Error running analysis:', error);
  }
}

main();
