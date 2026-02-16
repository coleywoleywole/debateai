#!/usr/bin/env node
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const DATABASE_ID = process.env.CLOUDFLARE_D1_DATABASE_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

async function analyze() {
  if (!ACCOUNT_ID || !DATABASE_ID || !API_TOKEN) {
    console.error('Missing credentials');
    process.exit(1);
  }

  // Fetch 20 recent debates to find suitable candidates
  const sql = `
    SELECT 
      d.id,
      d.topic,
      d.messages,
      d.created_at
    FROM debates d
    ORDER BY d.created_at DESC
    LIMIT 20;
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
      console.error('Query failed', JSON.stringify(data, null, 2));
      return;
    }

    const rows = data.result[0].results;
    let analyzedCount = 0;

    console.log("Analyzing first 5 messages of recent debates...\n");

    for (const row of rows) {
      if (analyzedCount >= 10) break;

      let messages = [];
      try {
        messages = typeof row.messages === 'string' ? JSON.parse(row.messages) : row.messages;
      } catch {
        continue;
      }

      if (!messages || !Array.isArray(messages) || messages.length === 0) continue;

      console.log(`=== Debate: ${row.topic} (${row.created_at}) ===`);
      messages.slice(0, 5).forEach((m, i) => {
        // Attempt to detect role/content from common schemas
        const role = m.role || (m.sender === 'user' ? 'User' : 'AI');
        const content = m.content || m.text || JSON.stringify(m);
        console.log(`[${i+1}] ${role}: ${String(content).substring(0, 200).replace(/\n/g, ' ')}...`);
      });
      console.log(`Total messages: ${messages.length}`);
      console.log("--------------------------------------------------\n");
      analyzedCount++;
    }

  } catch (error) {
    console.error(error);
  }
}

analyze();
