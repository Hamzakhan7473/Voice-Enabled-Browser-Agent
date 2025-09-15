#!/usr/bin/env node

// Simple setup test for Voice Enabled Browser Agent
import dotenv from 'dotenv';
import fs from 'fs-extra';
import path from 'path';

dotenv.config();

console.log('🧪 Voice Enabled Browser Agent - Setup Test');
console.log('==========================================');

// Test 1: Environment variables
console.log('\n1. Testing environment variables...');
const requiredEnvVars = [
  'DEEPGRAM_API_KEY',
  'BROWSERBASE_API_KEY', 
  'BROWSERBASE_PROJECT_ID',
  'OPENAI_API_KEY'
];

let envVarsOk = true;
for (const envVar of requiredEnvVars) {
  if (process.env[envVar]) {
    console.log(`✅ ${envVar}: Set`);
  } else {
    console.log(`❌ ${envVar}: Missing`);
    envVarsOk = false;
  }
}

if (!envVarsOk) {
  console.log('\n⚠️  Some environment variables are missing.');
  console.log('   Please check your .env file.');
} else {
  console.log('\n✅ All environment variables are set.');
}

// Test 2: Directory structure
console.log('\n2. Testing directory structure...');
const requiredDirs = [
  'src',
  'public',
  'screenshots',
  'exports',
  'archives',
  'logs',
  'temp',
  'context',
  'audio'
];

let dirsOk = true;
for (const dir of requiredDirs) {
  if (await fs.pathExists(dir)) {
    console.log(`✅ ${dir}/: Exists`);
  } else {
    console.log(`❌ ${dir}/: Missing`);
    dirsOk = false;
  }
}

if (!dirsOk) {
  console.log('\n⚠️  Some directories are missing.');
  console.log('   Run: mkdir -p screenshots exports archives logs temp context audio');
} else {
  console.log('\n✅ All required directories exist.');
}

// Test 3: Core modules
console.log('\n3. Testing core modules...');
try {
  const { default: AudioCapture } = await import('./src/audio/AudioCapture.js');
  console.log('✅ AudioCapture: Loaded');
} catch (error) {
  console.log(`❌ AudioCapture: ${error.message}`);
}

try {
  const { default: SpeechToText } = await import('./src/speech/SpeechToText.js');
  console.log('✅ SpeechToText: Loaded');
} catch (error) {
  console.log(`❌ SpeechToText: ${error.message}`);
}

try {
  const { default: IntentParser } = await import('./src/nlp/IntentParser.js');
  console.log('✅ IntentParser: Loaded');
} catch (error) {
  console.log(`❌ IntentParser: ${error.message}`);
}

try {
  const { default: BrowserController } = await import('./src/browser/BrowserController.js');
  console.log('✅ BrowserController: Loaded');
} catch (error) {
  console.log(`❌ BrowserController: ${error.message}`);
}

try {
  const { default: VoiceAgent } = await import('./src/core/VoiceAgent.js');
  console.log('✅ VoiceAgent: Loaded');
} catch (error) {
  console.log(`❌ VoiceAgent: ${error.message}`);
}

// Test 4: Package.json
console.log('\n4. Testing package.json...');
try {
  const packageJson = await fs.readJson('package.json');
  console.log(`✅ Package: ${packageJson.name} v${packageJson.version}`);
  console.log(`✅ Main: ${packageJson.main}`);
  console.log(`✅ Type: ${packageJson.type}`);
} catch (error) {
  console.log(`❌ Package.json: ${error.message}`);
}

// Test 5: Web interface
console.log('\n5. Testing web interface...');
if (await fs.pathExists('public/index.html')) {
  console.log('✅ Web interface: Available');
} else {
  console.log('❌ Web interface: Missing');
}

console.log('\n🎯 Setup Test Complete!');
console.log('\nTo start the application:');
console.log('  npm start');
console.log('\nThen open: http://localhost:3000');
