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

const MOCK_MODE = process.argv.includes('--mock') || !API_TOKEN;

async function analyzeQuality() {
  let abandoned = [];
  let completed = [];

  if (MOCK_MODE) {
    console.warn('⚠️  Running in MOCK MODE (No D1 credentials found or --mock flag used).');
    const mockData = generateMockData();
    abandoned = mockData.abandoned;
    completed = mockData.completed;
  } else {
    console.log('🔍 Querying for abandoned (10) and completed (5) debates...');
    try {
      const [resAbandoned, resCompleted] = await Promise.all([
        queryD1(`SELECT topic, messages FROM debates WHERE json_array_length(messages) > 0 AND json_array_length(messages) < 5 ORDER BY created_at DESC LIMIT 10;`),
        queryD1(`SELECT topic, messages FROM debates WHERE json_array_length(messages) > 10 ORDER BY created_at DESC LIMIT 5;`)
      ]);
      abandoned = resAbandoned.result?.[0]?.results || [];
      completed = resCompleted.result?.[0]?.results || [];
    } catch (error) {
      console.error('❌ Error executing query:', error);
      process.exit(1);
    }
  }

  console.log(`✅ Analyzing ${abandoned.length} abandoned and ${completed.length} completed debates...`);

  const analysis = {
    abandoned_issues: analyzeDebates(abandoned),
    completed_patterns: analyzeDebates(completed),
  };

  generateReport(analysis);
}

function analyzeDebates(debates) {
  return debates.map((d, i) => {
    let messages = [];
    try {
      messages = typeof d.messages === 'string' ? JSON.parse(d.messages) : d.messages;
    } catch {
      console.warn('Failed to parse messages for debate', i);
      return { error: 'Parse Error' };
    }

    const aiMessages = messages.filter(m => m.role === 'ai' || m.role === 'model');
    const lastAiMessage = aiMessages[aiMessages.length - 1]?.content || "";

    // Check for repetition
    const repetition = checkRepetition(aiMessages);
    
    // Check engagement (does it end with a question?)
    const endsWithQuestion = lastAiMessage.trim().endsWith('?');

    // Check formatting (Markdown usage)
    const hasMarkdown = lastAiMessage.includes('**') || lastAiMessage.includes('*');

    return {
      topic: d.topic,
      message_count: messages.length,
      last_ai_message_preview: lastAiMessage.slice(0, 50) + '...',
      issues: {
        repetitive: repetition.isRepetitive,
        ends_with_question: endsWithQuestion,
        has_formatting: hasMarkdown,
      }
    };
  });
}

function checkRepetition(aiMessages) {
  if (aiMessages.length < 2) return { isRepetitive: false };
  // Simple check: same start phrase
  const starts = aiMessages.map(m => m.content.slice(0, 20));
  const uniqueStarts = new Set(starts);
  return { isRepetitive: uniqueStarts.size < starts.length };
}

function generateMockData() {
  return {
    abandoned: Array(10).fill(0).map(() => ({
      topic: "Universal Basic Income",
      messages: JSON.stringify([
        { role: "user", content: "UBI is necessary." },
        { role: "ai", content: "While UBI addresses poverty, it may cause inflation. What about that?" },
        { role: "user", content: "Inflation is manageable." },
        { role: "ai", content: "While UBI addresses poverty, it may cause inflation. Think about the economy." } // Repetitive
      ])
    })),
    completed: Array(5).fill(0).map(() => ({
      topic: "AI Safety",
      messages: JSON.stringify(Array(12).fill({ role: "ai", content: "Valid point. However, consider the risks. How do we mitigate them?" }))
    }))
  };
}

function generateReport(analysis) {
  const report = `
# Debate Quality Analysis Report
**Generated:** ${new Date().toLocaleString()}
**Mode:** ${MOCK_MODE ? 'MOCK DATA (Credentials Missing)' : 'LIVE DATA'}

## Executive Summary
Analyzed ${analysis.abandoned_issues.length} abandoned debates and ${analysis.completed_patterns.length} completed debates.

## Findings from Abandoned Debates
${analysis.abandoned_issues.map(d => `- **${d.topic}** (${d.message_count} msgs): 
  - Repetitive: ${d.issues.repetitive ? 'YES ⚠️' : 'No'}
  - Ends with Question: ${d.issues.ends_with_question ? 'Yes' : 'NO ❌'}
  - Formatted: ${d.issues.has_formatting ? 'Yes' : 'No'}`).join('\n')}

## Findings from Completed Debates
${analysis.completed_patterns.map(d => `- **${d.topic}** (${d.message_count} msgs): Engaging? ${d.issues.ends_with_question ? 'Yes' : 'No'}`).join('\n')}

## Recommendations
1. **Fix Repetition:** Detect if AI starts consecutive messages with similar phrases ("While...", "I understand...").
2. **Engagement:** Ensure every AI response ends with a provocative question to drive the debate forward.
3. **Formatting:** Use bolding for key points to improve readability.
`;

  const outputPath = join(__dirname, '..', 'ANALYSIS_REPORT.md');
  fs.writeFileSync(outputPath, report);
  console.log(`📄 Report generated at ${outputPath}`);
}

async function queryD1(sql) {
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
  return await response.json();
}

analyzeQuality();
