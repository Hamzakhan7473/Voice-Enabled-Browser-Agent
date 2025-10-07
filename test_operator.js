#!/usr/bin/env node

/**
 * Simple test script to verify OpenAI Operator functionality
 */
import BrowserController from './src/browser/BrowserController.js';
import ComputerUseAgent from './src/core/ComputerUseAgent.js';

async function testOperator() {
    console.log('🧪 Testing OpenAI Operator-style functionality...');
    
    try {
        // 1. Initialize browser
        const browserController = new BrowserController({
            timeout: 15000,
            headless: false,
            viewport: { width: 1920, height: 1080 }
        });
        
        await browserController.createSession();
        console.log('✅ Browser initialized');
        
        // 2. Initialize computer-use agent
        const computerAgent = new ComputerUseAgent({
            browserController: browserController
        });
        
        // Set up event listeners for live screenshots
        computerAgent.on('action-observed', (data) => {
            console.log(`📸 Action ${data.step}: ${data.action.action} - Screenshot captured`);
            console.log(`   Message: ${data.message}`);
        });
        
        // 3. Test a simple goal
        console.log('🎯 Testing: Navigate to Google and search for OpenAI');
        
        const result = await computerAgent.executeGoal('Navigate to Google and search for OpenAI');
        
        console.log('🎉 Test completed!');
        console.log('Result:', result);
        
        // Clean up
        await browserController.closeSession();
        console.log('✅ Browser closed');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
testOperator().catch(console.error);
