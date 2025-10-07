/**
 * Example: Using the Browser Agent API
 * Run the server first: npm start
 */

// Example 1: Simple fetch request
async function example1_hackernews() {
  console.log('Example 1: Get Hacker News top stories\n');
  
  const response = await fetch('http://localhost:3000/agent/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      goal: 'Get the top 5 story titles and links from Hacker News',
      startUrl: 'https://news.ycombinator.com',
      maxSteps: 5
    })
  });

  const result = await response.json();
  
  console.log('Success:', result.success);
  console.log('Steps:', result.steps);
  console.log('Duration:', result.duration, 'ms');
  console.log('Result:\n', result.result);
  console.log('\n---\n');
}

// Example 2: Web search with extraction
async function example2_search() {
  console.log('Example 2: Web search and extract\n');
  
  const response = await fetch('http://localhost:3000/agent/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      goal: 'Search for "TypeScript best practices" and summarize the top 3 results',
      startUrl: 'https://www.google.com',
      maxSteps: 15,
      allowedDomains: ['google.com']
    })
  });

  const result = await response.json();
  
  console.log('Success:', result.success);
  console.log('Result:\n', result.result);
  console.log('\n---\n');
}

// Example 3: Data extraction
async function example3_wikipedia() {
  console.log('Example 3: Wikipedia article extraction\n');
  
  const response = await fetch('http://localhost:3000/agent/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      goal: 'Extract the first 3 paragraphs from the Wikipedia article on Artificial Intelligence',
      startUrl: 'https://en.wikipedia.org/wiki/Artificial_intelligence',
      maxSteps: 3,
      successCriteria: ['Return clean text paragraphs']
    })
  });

  const result = await response.json();
  
  console.log('Success:', result.success);
  console.log('Result:\n', result.result?.slice(0, 500) + '...');
  console.log('\n---\n');
}

// Example 4: Health check
async function example4_health() {
  console.log('Example 4: Health check\n');
  
  const response = await fetch('http://localhost:3000/health');
  const health = await response.json();
  
  console.log('Server status:', health.status);
  console.log('Active runs:', health.activeRuns);
  console.log('Timestamp:', new Date(health.timestamp).toISOString());
  console.log('\n---\n');
}

// Run all examples
async function runExamples() {
  try {
    // Check server is running
    await example4_health();
    
    // Run agent examples (uncomment to run)
    // await example1_hackernews();
    // await example2_search();
    // await example3_wikipedia();
    
    console.log('✅ All examples completed!');
    console.log('\nUncomment the example calls to run agent tasks.');
    
  } catch (error) {
    if (error.cause?.code === 'ECONNREFUSED') {
      console.error('❌ Server not running. Start it with: npm start');
    } else {
      console.error('Error:', error.message);
    }
  }
}

runExamples();

