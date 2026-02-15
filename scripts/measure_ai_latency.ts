import { performance } from 'perf_hooks';

async function main() {
  console.log("Starting API Latency Measurement...");
  
  const endpoint = 'http://localhost:3002/api/debate';
  const iterations = 10;
  const results: { ttfb: number; total: number; success: boolean }[] = [];

  for (let i = 0; i < iterations; i++) {
    console.log(`Iteration ${i + 1}/${iterations}...`);
    
    const startTime = performance.now();
    let ttfb = 0;
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Simulate headers if needed
        },
        body: JSON.stringify({
          topic: "Is AI dangerous?",
          character: "elon",
          opponentStyle: "Elon Musk",
          userArgument: "I think AI is dangerous because it can outsmart us.",
          previousMessages: [],
          isAIAssisted: false,
          debateId: `test-latency-${Date.now()}-${i}`
        })
      });

      if (!response.ok) {
        console.error(`Request failed: ${response.status} ${response.statusText}`);
        const text = await response.text();
        console.error(text);
        results.push({ ttfb: 0, total: 0, success: false });
        continue;
      }

      // Measure TTFB (when headers/first chunk received)
      // fetch resolves on headers received, but body is a stream.
      // Actually, response is resolved when headers are received.
      ttfb = performance.now() - startTime;
      
      // Read stream to completion to get total time
      if (!response.body) {
        console.error("No response body");
        continue;
      }

      for await (const chunk of response.body) {
        // Consume stream
      }

      const totalTime = performance.now() - startTime;
      
      console.log(`  TTFB: ${ttfb.toFixed(2)}ms, Total: ${totalTime.toFixed(2)}ms`);
      results.push({ ttfb, total: totalTime, success: true });
      
    } catch (error) {
      console.error("Error:", error);
      results.push({ ttfb: 0, total: 0, success: false });
    }
    
    // Wait a bit between requests to avoid rate limits (though test mode might bypass)
    await new Promise(r => setTimeout(r, 100));
  }

  // Calculate stats
  const successful = results.filter(r => r.success);
  if (successful.length === 0) {
    console.error("No successful requests.");
    return;
  }

  const ttfbs = successful.map(r => r.ttfb).sort((a, b) => a - b);
  const totals = successful.map(r => r.total).sort((a, b) => a - b);

  const p50_ttfb = ttfbs[Math.floor(ttfbs.length * 0.5)];
  const p95_ttfb = ttfbs[Math.floor(ttfbs.length * 0.95)];
  const p99_ttfb = ttfbs[Math.floor(ttfbs.length * 0.99)];

  const p50_total = totals[Math.floor(totals.length * 0.5)];
  const p95_total = totals[Math.floor(totals.length * 0.95)];
  const p99_total = totals[Math.floor(totals.length * 0.99)];

  console.log("\nResults:");
  console.log(`TTFB: P50=${p50_ttfb.toFixed(2)}ms, P95=${p95_ttfb.toFixed(2)}ms, P99=${p99_ttfb.toFixed(2)}ms`);
  console.log(`Total: P50=${p50_total.toFixed(2)}ms, P95=${p95_total.toFixed(2)}ms, P99=${p99_total.toFixed(2)}ms`);
}

main();
