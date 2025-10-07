#!/usr/bin/env node
/**
 * Quick startup test - Verify the agent server starts correctly
 */

import { spawn } from 'child_process';
import fetch from 'node-fetch';

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;
const TIMEOUT = 30000; // 30 seconds

console.log('🚀 Starting browser agent server...\n');

// Start the server
const server = spawn('node', ['dist/agent/index.js'], {
  env: { ...process.env, MODE: 'server', PORT: String(PORT) },
  stdio: 'pipe'
});

let serverReady = false;
let serverOutput = '';

server.stdout.on('data', (data) => {
  const output = data.toString();
  serverOutput += output;
  
  if (output.includes('running on')) {
    serverReady = true;
  }
  
  // Show server logs
  process.stdout.write(output);
});

server.stderr.on('data', (data) => {
  serverOutput += data.toString();
  process.stderr.write(data);
});

// Wait for server to be ready
async function waitForServer() {
  const startTime = Date.now();
  
  while (Date.now() - startTime < TIMEOUT) {
    try {
      const response = await fetch(`${BASE_URL}/health`, { timeout: 2000 });
      if (response.status === 200) {
        return true;
      }
    } catch (error) {
      // Server not ready yet
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return false;
}

// Run tests
async function runTests() {
  console.log('\n⏳ Waiting for server to be ready...\n');
  
  const ready = await waitForServer();
  
  if (!ready) {
    console.error('\n❌ Server failed to start within timeout\n');
    server.kill();
    process.exit(1);
  }
  
  console.log('\n✅ Server is ready!\n');
  console.log('📊 Running quick health checks...\n');
  
  let allPassed = true;
  
  // Test 1: Health endpoint
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();
    console.log('✅ Health check passed');
    console.log(`   Status: ${data.status}`);
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    allPassed = false;
  }
  
  // Test 2: Frontend HTML
  try {
    const response = await fetch(`${BASE_URL}/ui/agent.html`);
    if (response.status === 200) {
      console.log('✅ Frontend accessible at /ui/agent.html');
    } else {
      console.error('❌ Frontend returned status:', response.status);
      allPassed = false;
    }
  } catch (error) {
    console.error('❌ Frontend check failed:', error.message);
    allPassed = false;
  }
  
  // Test 3: API endpoint exists
  try {
    const response = await fetch(`${BASE_URL}/agent/runs`);
    if (response.status === 200) {
      console.log('✅ API endpoints accessible');
    } else {
      console.error('❌ API returned status:', response.status);
      allPassed = false;
    }
  } catch (error) {
    console.error('❌ API check failed:', error.message);
    allPassed = false;
  }
  
  console.log('\n' + '='.repeat(50));
  
  if (allPassed) {
    console.log('\n🎉 All checks passed! Server is running correctly.\n');
    console.log('📡 API Server: ' + BASE_URL);
    console.log('🌐 Web UI: ' + BASE_URL + '/ui/agent.html');
    console.log('\n💡 Open your browser to the Web UI URL to get started!');
    console.log('   Press Ctrl+C to stop the server.\n');
  } else {
    console.log('\n⚠️  Some checks failed. See errors above.\n');
    server.kill();
    process.exit(1);
  }
}

// Run tests after a short delay
setTimeout(runTests, 2000);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down server...');
  server.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  server.kill();
  process.exit(0);
});

