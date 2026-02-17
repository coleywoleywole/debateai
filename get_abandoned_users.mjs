import fetch from 'node-fetch';
import dotenv from 'dotenv';
import fs from 'fs';

// Load credentials from shared secrets
const envFile = '/Users/spud/.openclaw/shared/secrets/.env.shared';
if (fs.existsSync(envFile)) {
  const envConfig = dotenv.parse(fs.readFileSync(envFile));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;

if (!accountId || !databaseId || !apiToken) {
  console.error('Missing D1 credentials');
  process.exit(1);
}

async function query(sql, params = []) {
  const url = 'https://api.cloudflare.com/client/v4/accounts/' + accountId + '/d1/database/' + databaseId + '/query';
  const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiToken,
      },
      body: JSON.stringify({ sql, params }),
    }
  );

  const data = await response.json();
  if (!data.success) {
    throw new Error('D1 query failed: ' + JSON.stringify(data.errors || data.error));
  }
  return data.result[0].results || [];
}

async function main() {
  try {
    const sql = "SELECT d.user_id, d.topic, d.created_at as debate_date, json_array_length(d.messages) as message_count, u.email, u.display_name, u.username FROM debates d JOIN users u ON d.user_id = u.user_id WHERE d.created_at >= datetime('now', '-3 days') AND json_array_length(d.messages) < 3 AND d.user_id NOT LIKE 'guest_%' AND u.email IS NOT NULL ORDER BY d.created_at DESC LIMIT 20;";
    const results = await query(sql);

    if (results.length === 0) {
      console.log("No users found.");
      return;
    }

    console.log("Name,Email,Debate Topic,Date,Message Count");
    results.forEach(row => {
      const name = row.display_name || row.username || 'Anonymous';
      console.log('"' + name + '","' + row.email + '","' + row.topic + '","' + row.debate_date + '",' + row.message_count);
    });
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
