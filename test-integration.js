/**
 * Integration test for backend API
 * Run this after starting the server: npm start
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

// Colors for terminal output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function log(message, color = RESET) {
  console.log(`${color}${message}${RESET}`);
}

// Test 1: Health check
async function testHealthCheck() {
  log('\n📊 Test 1: Health Check', YELLOW);
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();
    
    if (response.status === 200 && data.status === 'ok') {
      log('✅ Health check passed', GREEN);
      log(`   Status: ${data.status}`);
      log(`   Active runs: ${data.activeRuns}`);
      return true;
    } else {
      log('❌ Health check failed', RED);
      return false;
    }
  } catch (error) {
    log(`❌ Health check error: ${error.message}`, RED);
    return false;
  }
}

// Test 2: Static file serving (frontend)
async function testStaticFiles() {
  log('\n🌐 Test 2: Static File Serving', YELLOW);
  try {
    const response = await fetch(`${BASE_URL}/ui/agent.html`);
    const html = await response.text();
    
    if (response.status === 200 && html.includes('Browser Agent Dashboard')) {
      log('✅ Frontend HTML accessible', GREEN);
      log(`   Content length: ${html.length} bytes`);
      return true;
    } else {
      log('❌ Frontend not accessible', RED);
      return false;
    }
  } catch (error) {
    log(`❌ Static files error: ${error.message}`, RED);
    return false;
  }
}

// Test 3: Get active runs
async function testGetRuns() {
  log('\n📋 Test 3: Get Active Runs', YELLOW);
  try {
    const response = await fetch(`${BASE_URL}/agent/runs`);
    const data = await response.json();
    
    if (response.status === 200 && Array.isArray(data.active)) {
      log('✅ Get runs endpoint working', GREEN);
      log(`   Active runs: ${data.active.length}`);
      return true;
    } else {
      log('❌ Get runs failed', RED);
      return false;
    }
  } catch (error) {
    log(`❌ Get runs error: ${error.message}`, RED);
    return false;
  }
}

// Test 4: Agent run with simple goal (optional - costs money)
async function testAgentRun(runActualAgent = false) {
  log('\n🤖 Test 4: Agent Run API', YELLOW);
  
  if (!runActualAgent) {
    log('⏭️  Skipping actual agent run (set runActualAgent=true to test)', YELLOW);
    log('   This test costs money (OpenAI API calls)');
    return true;
  }
  
  try {
    log('   Starting agent run (this may take 30-60 seconds)...');
    
    const response = await fetch(`${BASE_URL}/agent/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal: 'Get the main heading text from example.com',
        startUrl: 'https://example.com',
        maxSteps: 3
      })
    });
    
    const data = await response.json();
    
    if (response.status === 200) {
      log('✅ Agent run completed', GREEN);
      log(`   Success: ${data.success}`);
      log(`   Steps: ${data.steps}`);
      log(`   Duration: ${(data.duration / 1000).toFixed(2)}s`);
      if (data.result) {
        log(`   Result: ${data.result.slice(0, 100)}...`);
      }
      return data.success;
    } else {
      log('❌ Agent run failed', RED);
      log(`   Error: ${data.error || 'Unknown error'}`);
      return false;
    }
  } catch (error) {
    log(`❌ Agent run error: ${error.message}`, RED);
    return false;
  }
}

// Test 5: API validation (bad requests)
async function testAPIValidation() {
  log('\n🛡️  Test 5: API Validation', YELLOW);
  try {
    // Try without goal
    const response = await fetch(`${BASE_URL}/agent/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    if (response.status === 400) {
      log('✅ API validation working (rejected empty goal)', GREEN);
      return true;
    } else {
      log('❌ API validation not working properly', RED);
      return false;
    }
  } catch (error) {
    log(`❌ Validation test error: ${error.message}`, RED);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  log('\n╔════════════════════════════════════════╗', YELLOW);
  log('║  Browser Agent Integration Tests      ║', YELLOW);
  log('╚════════════════════════════════════════╝', YELLOW);
  
  const results = {
    health: false,
    static: false,
    runs: false,
    agent: false,
    validation: false
  };
  
  results.health = await testHealthCheck();
  results.static = await testStaticFiles();
  results.runs = await testGetRuns();
  results.validation = await testAPIValidation();
  
  // Optionally run actual agent (costs money)
  // results.agent = await testAgentRun(true);
  
  // Summary
  log('\n╔════════════════════════════════════════╗', YELLOW);
  log('║           Test Summary                 ║', YELLOW);
  log('╚════════════════════════════════════════╝', YELLOW);
  
  const passed = Object.values(results).filter(r => r).length;
  const total = Object.values(results).length;
  
  Object.entries(results).forEach(([test, passed]) => {
    const icon = passed ? '✅' : '❌';
    log(`${icon} ${test.padEnd(15)} ${passed ? 'PASSED' : 'FAILED'}`, passed ? GREEN : RED);
  });
  
  log(`\n📊 Total: ${passed}/${total} tests passed\n`, passed === total ? GREEN : RED);
  
  if (passed === total) {
    log('🎉 All tests passed! Backend and frontend are working correctly.\n', GREEN);
    log('Next steps:', YELLOW);
    log('  1. Open http://localhost:3000/ui/agent.html in your browser');
    log('  2. Try running an example agent task');
    log('  3. Check logs/ directory for execution logs');
    log('  4. Review screenshots/ directory for captures\n');
  } else {
    log('⚠️  Some tests failed. Check the server logs for details.\n', RED);
  }
  
  process.exit(passed === total ? 0 : 1);
}

// Check if server is running before testing
async function checkServer() {
  try {
    await fetch(`${BASE_URL}/health`);
    return true;
  } catch (error) {
    log('\n❌ Server is not running!', RED);
    log('   Start the server first: npm start\n', YELLOW);
    log('   Or if using a different port, update BASE_URL in this script.\n');
    return false;
  }
}

// Main
(async () => {
  const serverRunning = await checkServer();
  if (serverRunning) {
    await runAllTests();
  } else {
    process.exit(1);
  }
})();

