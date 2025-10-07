#!/usr/bin/env node
/**
 * Comprehensive verification of backend-frontend connectivity
 * This checks all API endpoints and frontend integration
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COLORS = {
  GREEN: '\x1b[32m',
  RED: '\x1b[31m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[36m',
  RESET: '\x1b[0m'
};

function log(message, color = COLORS.RESET) {
  console.log(`${color}${message}${COLORS.RESET}`);
}

// Check 1: Verify build exists
function checkBuild() {
  log('\n📦 Check 1: Build Verification', COLORS.YELLOW);
  
  const requiredFiles = [
    'dist/agent/index.js',
    'dist/agent/api-server.js',
    'dist/agent/browser-agent.js',
    'dist/agent/llm-client.js',
    'dist/agent/tool-executor.js',
    'public/agent.html'
  ];
  
  let allExist = true;
  
  for (const file of requiredFiles) {
    const exists = fs.existsSync(path.join(process.cwd(), file));
    if (exists) {
      log(`  ✅ ${file}`, COLORS.GREEN);
    } else {
      log(`  ❌ ${file} (missing!)`, COLORS.RED);
      allExist = false;
    }
  }
  
  if (!allExist) {
    log('\n⚠️  Some files are missing. Run: npm run build', COLORS.RED);
    return false;
  }
  
  log('\n✅ All required files exist', COLORS.GREEN);
  return true;
}

// Check 2: Verify environment variables
function checkEnvironment() {
  log('\n🔐 Check 2: Environment Variables', COLORS.YELLOW);
  dotenv.config();
  
  const required = ['OPENAI_API_KEY'];
  const optional = ['OPENAI_MODEL', 'PORT', 'HEADLESS', 'ALLOWED_DOMAINS'];
  
  let hasRequired = true;
  
  for (const key of required) {
    if (process.env[key]) {
      const value = key.includes('KEY') ? '****' + process.env[key].slice(-4) : process.env[key];
      log(`  ✅ ${key}: ${value}`, COLORS.GREEN);
    } else {
      log(`  ❌ ${key}: Not set`, COLORS.RED);
      hasRequired = false;
    }
  }
  
  log('\n  Optional variables:', COLORS.BLUE);
  for (const key of optional) {
    if (process.env[key]) {
      log(`  ✓  ${key}: ${process.env[key]}`, COLORS.BLUE);
    } else {
      log(`  -  ${key}: Using default`, COLORS.BLUE);
    }
  }
  
  if (!hasRequired) {
    log('\n⚠️  Required environment variables missing', COLORS.RED);
    log('   Create a .env file with: OPENAI_API_KEY=your_key_here', COLORS.YELLOW);
    return false;
  }
  
  log('\n✅ Environment configured correctly', COLORS.GREEN);
  return true;
}

// Check 3: Verify API routes configuration
function checkAPIRoutes() {
  log('\n🔌 Check 3: API Routes Configuration', COLORS.YELLOW);
  const apiServerCode = fs.readFileSync('src/agent/api-server.ts', 'utf-8');
  
  const requiredRoutes = [
    { pattern: /\.get\(['"]\/health['"]/, name: 'GET /health' },
    { pattern: /\.post[^(]*\(['"]\/agent\/run['"]/, name: 'POST /agent/run' },
    { pattern: /\.get\(['"]\/agent\/runs['"]/, name: 'GET /agent/runs' },
    { pattern: /fastifyStatic/, name: 'Static file serving' }
  ];
  
  let allRoutesFound = true;
  
  for (const route of requiredRoutes) {
    if (route.pattern.test(apiServerCode)) {
      log(`  ✅ ${route.name}`, COLORS.GREEN);
    } else {
      log(`  ❌ ${route.name} (not found!)`, COLORS.RED);
      allRoutesFound = false;
    }
  }
  
  if (!allRoutesFound) {
    log('\n⚠️  Some routes missing in api-server.ts', COLORS.RED);
    return false;
  }
  
  log('\n✅ All API routes properly configured', COLORS.GREEN);
  return true;
}

// Check 4: Verify frontend API calls
function checkFrontendIntegration() {
  log('\n🌐 Check 4: Frontend-Backend Integration', COLORS.YELLOW);
  const frontendCode = fs.readFileSync('public/agent.html', 'utf-8');
  
  const requiredAPICalls = [
    { pattern: /fetch\(['"]\/health['"]\)/, name: 'Health check call' },
    { pattern: /fetch\(['"]\/agent\/run['"]/, name: 'Agent run call' },
    { pattern: /method:\s*['"]POST['"]/, name: 'POST request setup' },
    { pattern: /'Content-Type':\s*['"]application\/json['"]/, name: 'JSON content type' }
  ];
  
  let allCallsFound = true;
  
  for (const call of requiredAPICalls) {
    if (call.pattern.test(frontendCode)) {
      log(`  ✅ ${call.name}`, COLORS.GREEN);
    } else {
      log(`  ❌ ${call.name} (not found!)`, COLORS.RED);
      allCallsFound = false;
    }
  }
  
  // Check for UI elements
  const uiElements = [
    { pattern: /id=["']goal["']/, name: 'Goal input field' },
    { pattern: /id=["']submitBtn["']/, name: 'Submit button' },
    { pattern: /id=["']result["']/, name: 'Result display' }
  ];
  
  log('\n  UI Elements:', COLORS.BLUE);
  for (const element of uiElements) {
    if (element.pattern.test(frontendCode)) {
      log(`  ✅ ${element.name}`, COLORS.GREEN);
    } else {
      log(`  ❌ ${element.name} (not found!)`, COLORS.RED);
      allCallsFound = false;
    }
  }
  
  if (!allCallsFound) {
    log('\n⚠️  Frontend integration issues detected', COLORS.RED);
    return false;
  }
  
  log('\n✅ Frontend properly integrated with backend', COLORS.GREEN);
  return true;
}

// Check 5: Verify static file serving path
function checkStaticPaths() {
  log('\n📁 Check 5: Static File Serving Paths', COLORS.YELLOW);
  const apiServerCode = fs.readFileSync('src/agent/api-server.ts', 'utf-8');
  
  // Check if path resolution is correct
  const pathChecks = [
    { pattern: /__dirname.*\.\.\/\.\.\/public/, name: 'Public directory path resolution' },
    { pattern: /prefix:\s*['"]\/ui\/['"]/, name: 'UI prefix (/ui/)' }
  ];
  
  let allPathsCorrect = true;
  
  for (const check of pathChecks) {
    if (check.pattern.test(apiServerCode)) {
      log(`  ✅ ${check.name}`, COLORS.GREEN);
    } else {
      log(`  ❌ ${check.name} (incorrect!)`, COLORS.RED);
      allPathsCorrect = false;
    }
  }
  
  // Verify public directory exists
  if (fs.existsSync('public') && fs.existsSync('public/agent.html')) {
    log(`  ✅ public/agent.html exists`, COLORS.GREEN);
  } else {
    log(`  ❌ public/agent.html missing`, COLORS.RED);
    allPathsCorrect = false;
  }
  
  if (!allPathsCorrect) {
    log('\n⚠️  Static file serving path issues', COLORS.RED);
    return false;
  }
  
  log('\n✅ Static file paths correctly configured', COLORS.GREEN);
  return true;
}

// Summary
function printSummary(results) {
  log('\n' + '='.repeat(60), COLORS.YELLOW);
  log('                    VERIFICATION SUMMARY', COLORS.YELLOW);
  log('='.repeat(60), COLORS.YELLOW);
  
  const checks = [
    ['Build Verification', results.build],
    ['Environment Variables', results.environment],
    ['API Routes Configuration', results.routes],
    ['Frontend Integration', results.frontend],
    ['Static File Paths', results.paths]
  ];
  
  log('\n');
  checks.forEach(([name, passed]) => {
    const icon = passed ? '✅' : '❌';
    const color = passed ? COLORS.GREEN : COLORS.RED;
    log(`${icon} ${name.padEnd(35)} ${passed ? 'PASSED' : 'FAILED'}`, color);
  });
  
  const passCount = Object.values(results).filter(r => r).length;
  const totalCount = Object.values(results).length;
  
  log('\n' + '='.repeat(60), COLORS.YELLOW);
  log(`\n📊 Result: ${passCount}/${totalCount} checks passed\n`, 
      passCount === totalCount ? COLORS.GREEN : COLORS.RED);
  
  if (passCount === totalCount) {
    log('🎉 EXCELLENT! Backend and frontend are properly connected!\n', COLORS.GREEN);
    log('Next steps:', COLORS.BLUE);
    log('  1. Start the server: npm start');
    log('  2. Open http://localhost:3000/ui/agent.html');
    log('  3. Try an example task from the dashboard');
    log('  4. (Optional) Run integration tests: node test-integration.js\n');
  } else {
    log('⚠️  ISSUES FOUND! Please fix the failed checks above.\n', COLORS.RED);
    log('Common fixes:', COLORS.YELLOW);
    log('  - Run: npm run build');
    log('  - Create .env file with OPENAI_API_KEY');
    log('  - Check that public/agent.html exists');
    log('  - Verify src/agent/ files are not corrupted\n');
  }
  
  return passCount === totalCount;
}

// Main execution
function main() {
  log('\n╔════════════════════════════════════════════════════════════╗', COLORS.BLUE);
  log('║     Backend-Frontend Connectivity Verification            ║', COLORS.BLUE);
  log('║     Production Browser Agent                              ║', COLORS.BLUE);
  log('╚════════════════════════════════════════════════════════════╝', COLORS.BLUE);
  
  const results = {
    build: checkBuild(),
    environment: checkEnvironment(),
    routes: checkAPIRoutes(),
    frontend: checkFrontendIntegration(),
    paths: checkStaticPaths()
  };
  
  const allPassed = printSummary(results);
  
  process.exit(allPassed ? 0 : 1);
}

// Run
main();

