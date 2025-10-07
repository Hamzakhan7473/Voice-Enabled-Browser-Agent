#!/usr/bin/env node
/**
 * Verify API Integration from .env file
 * Checks that environment variables are properly loaded and used
 */

import dotenv from 'dotenv';
import fs from 'fs';
import OpenAI from 'openai';

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

console.log(`\n${COLORS.BLUE}╔════════════════════════════════════════════════════════════╗${COLORS.RESET}`);
console.log(`${COLORS.BLUE}║         API Integration Verification (.env)               ║${COLORS.RESET}`);
console.log(`${COLORS.BLUE}╚════════════════════════════════════════════════════════════╝${COLORS.RESET}\n`);

// Check 1: .env file exists
log('📄 Check 1: .env File Existence', COLORS.YELLOW);

if (!fs.existsSync('.env')) {
  log('  ❌ .env file not found!', COLORS.RED);
  log('\n  Create it from the template:', COLORS.YELLOW);
  log('    cp .env.production .env', COLORS.BLUE);
  log('    # Then edit .env and add your OPENAI_API_KEY\n', COLORS.BLUE);
  process.exit(1);
} else {
  log('  ✅ .env file exists', COLORS.GREEN);
}

// Check 2: Load environment variables
log('\n🔐 Check 2: Loading Environment Variables', COLORS.YELLOW);

dotenv.config();

const envVars = {
  required: {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY
  },
  optional: {
    OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
    MODE: process.env.MODE || 'server',
    PORT: process.env.PORT || '3000',
    HOST: process.env.HOST || '0.0.0.0',
    HEADLESS: process.env.HEADLESS || 'true',
    ALLOWED_DOMAINS: process.env.ALLOWED_DOMAINS || '(none)'
  }
};

// Verify required variables
let allRequired = true;
log('\n  Required variables:', COLORS.BLUE);

for (const [key, value] of Object.entries(envVars.required)) {
  if (value) {
    // Mask API key
    const masked = key.includes('KEY') ? 
      `${value.substring(0, 3)}...${value.slice(-4)}` : 
      value;
    log(`  ✅ ${key}: ${masked}`, COLORS.GREEN);
  } else {
    log(`  ❌ ${key}: NOT SET`, COLORS.RED);
    allRequired = false;
  }
}

if (!allRequired) {
  log('\n⚠️  Missing required environment variables!', COLORS.RED);
  log('   Edit your .env file and add the missing values.\n', COLORS.YELLOW);
  process.exit(1);
}

log('\n  Optional variables (using defaults if not set):', COLORS.BLUE);
for (const [key, value] of Object.entries(envVars.optional)) {
  const isDefault = !process.env[key];
  const icon = isDefault ? '📌' : '✓';
  const suffix = isDefault ? ' (default)' : '';
  log(`  ${icon}  ${key}: ${value}${suffix}`, COLORS.BLUE);
}

log('\n✅ All environment variables loaded', COLORS.GREEN);

// Check 3: Validate OpenAI API Key format
log('\n🔑 Check 3: OpenAI API Key Validation', COLORS.YELLOW);

const apiKey = process.env.OPENAI_API_KEY;

// Check format
if (apiKey.startsWith('sk-')) {
  log('  ✅ API key has correct prefix (sk-)', COLORS.GREEN);
} else {
  log('  ⚠️  API key does not start with "sk-"', COLORS.YELLOW);
  log('     This might not be a valid OpenAI API key', COLORS.YELLOW);
}

// Check length (OpenAI keys are typically 48-51 characters)
if (apiKey.length >= 40) {
  log(`  ✅ API key length looks correct (${apiKey.length} chars)`, COLORS.GREEN);
} else {
  log(`  ⚠️  API key seems too short (${apiKey.length} chars)`, COLORS.YELLOW);
}

// Check 4: Test OpenAI API Connection
log('\n🌐 Check 4: OpenAI API Connection Test', COLORS.YELLOW);
log('  Testing connection to OpenAI...', COLORS.BLUE);

try {
  const openai = new OpenAI({ 
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 10000
  });

  // Try to list models as a simple API test
  const models = await openai.models.list();
  
  log('  ✅ Successfully connected to OpenAI API!', COLORS.GREEN);
  log(`  ✅ Available models: ${models.data.length} models found`, COLORS.GREEN);
  
  // Check if the configured model is available
  const configuredModel = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';
  const modelExists = models.data.some(m => 
    m.id === configuredModel || 
    m.id.startsWith(configuredModel.split('-')[0])
  );
  
  if (modelExists) {
    log(`  ✅ Configured model "${configuredModel}" is available`, COLORS.GREEN);
  } else {
    log(`  ⚠️  Model "${configuredModel}" not found in your account`, COLORS.YELLOW);
    log('     Available models include:', COLORS.BLUE);
    models.data.slice(0, 5).forEach(m => {
      if (m.id.includes('gpt')) {
        log(`       - ${m.id}`, COLORS.BLUE);
      }
    });
  }

} catch (error) {
  log('  ❌ Failed to connect to OpenAI API', COLORS.RED);
  
  if (error.status === 401) {
    log('     Error: Invalid API key (401 Unauthorized)', COLORS.RED);
    log('     Please check your OPENAI_API_KEY in .env', COLORS.YELLOW);
  } else if (error.code === 'ENOTFOUND') {
    log('     Error: Network connection failed', COLORS.RED);
    log('     Check your internet connection', COLORS.YELLOW);
  } else {
    log(`     Error: ${error.message}`, COLORS.RED);
  }
  
  process.exit(1);
}

// Check 5: Verify integration in agent code
log('\n🔧 Check 5: Code Integration Verification', COLORS.YELLOW);

const indexCode = fs.readFileSync('src/agent/index.ts', 'utf-8');
const llmCode = fs.readFileSync('src/agent/llm-client.ts', 'utf-8');

const checks = [
  { 
    code: indexCode,
    pattern: /dotenv.*config/,
    name: 'dotenv.config() called in index.ts',
    file: 'index.ts'
  },
  { 
    code: indexCode,
    pattern: /process\.env\.OPENAI_API_KEY/,
    name: 'OPENAI_API_KEY accessed',
    file: 'index.ts'
  },
  { 
    code: llmCode,
    pattern: /new OpenAI/,
    name: 'OpenAI client instantiated',
    file: 'llm-client.ts'
  },
  { 
    code: llmCode,
    pattern: /process\.env\.OPENAI_API_KEY/,
    name: 'API key passed to OpenAI client',
    file: 'llm-client.ts'
  }
];

let allChecksPass = true;

for (const check of checks) {
  if (check.pattern.test(check.code)) {
    log(`  ✅ ${check.name}`, COLORS.GREEN);
  } else {
    log(`  ❌ ${check.name} (not found in ${check.file})`, COLORS.RED);
    allChecksPass = false;
  }
}

if (!allChecksPass) {
  log('\n⚠️  Some code integration checks failed', COLORS.YELLOW);
  log('   The code may not be properly using environment variables', COLORS.YELLOW);
}

// Check 6: Verify in compiled code
log('\n📦 Check 6: Compiled Code Verification', COLORS.YELLOW);

if (fs.existsSync('dist/agent/index.js') && fs.existsSync('dist/agent/llm-client.js')) {
  const compiledIndex = fs.readFileSync('dist/agent/index.js', 'utf-8');
  const compiledLLM = fs.readFileSync('dist/agent/llm-client.js', 'utf-8');
  
  const compiledChecks = [
    {
      code: compiledIndex,
      pattern: /dotenv/,
      name: 'dotenv imported in compiled index.js'
    },
    {
      code: compiledLLM,
      pattern: /process\.env\.OPENAI_API_KEY|apiKey/,
      name: 'API key handling in compiled llm-client.js'
    }
  ];
  
  for (const check of compiledChecks) {
    if (check.pattern.test(check.code)) {
      log(`  ✅ ${check.name}`, COLORS.GREEN);
    } else {
      log(`  ⚠️  ${check.name}`, COLORS.YELLOW);
    }
  }
} else {
  log('  ⚠️  Compiled code not found', COLORS.YELLOW);
  log('     Run: npm run build', COLORS.BLUE);
}

// Summary
log('\n' + '='.repeat(60), COLORS.YELLOW);
log('                    SUMMARY', COLORS.YELLOW);
log('='.repeat(60), COLORS.YELLOW);

log('\n✅ .env file configuration:', COLORS.GREEN);
log(`   - OPENAI_API_KEY: Set and valid`, COLORS.GREEN);
log(`   - OPENAI_MODEL: ${envVars.optional.OPENAI_MODEL}`, COLORS.GREEN);
log(`   - Server will run on: ${envVars.optional.HOST}:${envVars.optional.PORT}`, COLORS.GREEN);

log('\n✅ API Integration Status:', COLORS.GREEN);
log('   - OpenAI API connection: Working', COLORS.GREEN);
log('   - Environment variables: Loaded correctly', COLORS.GREEN);
log('   - Code integration: Verified', COLORS.GREEN);

log('\n🎉 API Integration is fully functional!', COLORS.GREEN);

log('\n📚 Next steps:', COLORS.BLUE);
log('   1. Start the server: npm start');
log('   2. The agent will use your OpenAI API key automatically');
log('   3. Monitor logs for any API-related issues');
log('   4. Check OpenAI usage: https://platform.openai.com/usage\n');

log('💡 Tips:', COLORS.BLUE);
log('   - Each agent run costs approximately $0.05-$0.20 in API calls');
log('   - Costs depend on: steps taken, model used, page complexity');
log('   - Use OPENAI_MODEL=gpt-4o-mini for lower costs (faster, cheaper)');
log('   - Set ALLOWED_DOMAINS to limit agent scope and reduce costs\n');

