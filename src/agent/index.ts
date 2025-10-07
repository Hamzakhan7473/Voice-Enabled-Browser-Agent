/**
 * Main entry point for production agent
 * Clean CLI and server mode
 */

import dotenv from 'dotenv';
import { BrowserAgent } from './browser-agent.js';
import { AgentAPIServer } from './api-server.js';
import type { AgentGoal, AgentConfig } from './types.js';

// Load environment variables
dotenv.config();

/**
 * Default configuration
 */
const DEFAULT_CONFIG: AgentConfig = {
  llm: {
    model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
    temperature: 0.1,
    maxTokens: 4000
  },
  browser: {
    headless: process.env.HEADLESS !== 'false',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 }
  },
  safety: {
    allowedDomains: process.env.ALLOWED_DOMAINS?.split(',').map(d => d.trim()),
    blockedDomains: ['facebook.com', 'twitter.com'], // Example blocks
    requireConfirmation: ['checkout', 'payment', 'purchase', 'delete'],
    maxStepsPerDomain: 15,
    rateLimitMs: 1000,
    respectRobotsTxt: true
  },
  observability: {
    screenshotsDir: './screenshots',
    tracesDir: './traces',
    logsDir: './logs'
  },
  memory: {
    enabled: false
  }
};

/**
 * Run agent in CLI mode
 */
export async function runCLI() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
🤖 Browser Agent CLI

Usage:
  node dist/agent/index.js "<goal>" [startUrl]

Examples:
  node dist/agent/index.js "Get weather for NYC" "https://weather.com"
  node dist/agent/index.js "Top 5 Hacker News stories" "https://news.ycombinator.com"

Environment Variables:
  OPENAI_API_KEY      Your OpenAI API key (required)
  OPENAI_MODEL        Model to use (default: gpt-4-turbo-preview)
  HEADLESS            Run headless (default: true)
  ALLOWED_DOMAINS     Comma-separated list of allowed domains
    `);
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  const goal: AgentGoal = {
    userPrompt: args[0],
    maxSteps: 30
  };

  const startUrl = args[1];

  console.log('🚀 Starting browser agent...');
  console.log(`📋 Goal: ${goal.userPrompt}`);
  if (startUrl) console.log(`🌐 Start URL: ${startUrl}`);

  const agent = new BrowserAgent(DEFAULT_CONFIG);
  const result = await agent.run(goal, startUrl);

  if (result.success) {
    console.log('\n✅ Success!');
    console.log(`📊 Result: ${result.result}`);
    console.log(`🔢 Steps: ${result.steps}`);
  } else {
    console.log('\n❌ Failed');
    console.log(`⚠️ Error: ${result.error}`);
    console.log(`🔢 Steps: ${result.steps}`);
    process.exit(1);
  }
}

/**
 * Run agent in server mode
 */
export async function runServer() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  const port = parseInt(process.env.PORT || '3000');
  const host = process.env.HOST || '0.0.0.0';

  const server = new AgentAPIServer({
    port,
    host,
    agentConfig: DEFAULT_CONFIG
  });

  await server.start(port, host);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    await server.stop();
    process.exit(0);
  });
}

/**
 * Main entry
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const mode = process.env.MODE || 'server';
  
  if (mode === 'cli') {
    runCLI().catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
  } else {
    runServer().catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
  }
}

