import { d1 } from './src/lib/d1';

async function test() {
  console.log('Fetching debates...');
  const result = await d1.query(
    `SELECT 
      id,
      opponent,
      topic,
      messages,
      created_at,
      score_data
    FROM debates 
    ORDER BY created_at DESC 
    LIMIT 5`
  );

  console.log('Result success:', result.success);
  if (result.success && result.result) {
    console.log('Debates found:', result.result.length);
    if (result.result.length > 0) {
      console.log('Sample debate:', JSON.stringify(result.result[0], null, 2));
    }
  } else {
    console.error('Query failed:', result.error);
  }
}

test();
