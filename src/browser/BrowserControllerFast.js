import axios from 'axios';
import { chromium } from 'playwright';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class BrowserControllerFast extends EventEmitter {
    constructor(options = {}) {
        super();
        this.apiKey = process.env.BROWSERBASE_API_KEY;
        this.projectId = process.env.BROWSERBASE_PROJECT_ID;
        
        this.browserbaseApiUrl = 'https://api.browserbase.com/v1';
        this.browserbaseHeaders = {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
        };

        this.browser = null;
        this.context = null;
        this.page = null;
        this.sessionId = null;
        this.isConnected = false;
        this.isInitializing = false;
        this.currentState = 'idle';
        this.screenshotsDir = path.join(__dirname, '../../screenshots');
        this.sessionData = {
            startTime: null,
            currentUrl: null,
            pageTitle: null,
            actions: [],
            screenshots: [],
            extractedData: []
        };

        this.options = {
            timeout: parseInt(process.env.BROWSER_TIMEOUT) || 15000, // Faster timeout
            headless: process.env.BROWSER_HEADLESS === 'true',
            viewport: {
                width: parseInt(process.env.BROWSER_VIEWPORT_WIDTH) || 1920,
                height: parseInt(process.env.BROWSER_VIEWPORT_HEIGHT) || 1080
            },
            ...options
        };

        this.maxRetries = 2;
        this.retryCount = 0;
        this.profileDir = null;
    }

    // Ultra-fast session creation
    async createLocalSession() {
        try {
            if (this.isInitializing) {
                return this.sessionId; // Return existing session
            }

            if (this.isConnected) {
                return this.sessionId; // Already connected
            }
            
            this.isInitializing = true;
            this.currentState = 'initializing';
            console.log('⚡ Creating ultra-fast OpenAI operator browser session...');
            
            const fs = await import('fs');
            const path = await import('path');
            const os = await import('os');
            
            // Use process-specific temp directory
            const tempDir = os.tmpdir();
            const profileDir = path.join(tempDir, `chrome-fast-${process.pid}`);
            this.profileDir = profileDir;
            
            // Clean directory if exists
            if (fs.existsSync(profileDir)) {
                fs.rmSync(profileDir, { recursive: true, force: true });
            }
            
            console.log(`📁 Profile: ${profileDir}`);
            
            // Rapid browser launch with minimal options
            this.context = await chromium.launchPersistentContext(profileDir, {
                headless: false,
                viewport: this.options.viewport,
                timeout: 8000, // Fast timeout
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-background-timer-throttling',
                    '--disable-renderer-backgrounding',
                    '--disable-sync',
                    '--disable-translate',
                    '--mute-audio',
                    '--no-first-run',
                    '--disable-extensions',
                    '--window-size=1920,1080'
                ]
            });

            this.page = await this.context.newPage();
            
            // Basic stealth (minimal for speed)
            await this.page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                delete navigator.__proto__.webdriver;
            });

            this.sessionId = `fast_${Date.now()}`;
            this.isConnected = true;
            this.currentState = 'connected';
            this.sessionData.startTime = Date.now();
            this.isInitializing = false;
            
            console.log(`⚡ Fast browser session created: ${this.sessionId}`);
            
            return {
                success: true,
                sessionId: this.sessionId,
                type: 'local-fast'
            };
            
        } catch (error) {
            this.currentState = 'error';
            this.isInitializing = false;
            console.error('❌ Fast browser creation failed:', error.message);
            throw error;
        }
    }

    async createSession() {
        return this.createLocalSession();
    }

    // State methods
    state() {
        return {
            connected: this.isConnected,
            session: this.sessionId,
            url: this.sessionData.currentUrl,
            title: this.sessionData.pageTitle,
            internalState: this.currentState
        };
    }

    getStatus() {
        return {
            isConnected: this.isConnected,
            sessionId: this.sessionId,
            currentUrl: this.sessionData.currentUrl || null,
            pageTitle: this.sessionData.pageTitle || null,
            hasActiveSession: !!(this.context && this.page),
            internalState: this.currentState
        };
    }

    async navigateTo(url) {
        try {
            console.log(`🌐 Navigating to: ${url}`);
            await this.page.goto(url, { 
                waitUntil: 'domcontentloaded',
                timeout: this.options.timeout 
            });
            
            this.sessionData.currentUrl = url;
            this.sessionData.pageTitle = await this.page.title();
            
            console.log(`✅ Navigation completed: ${this.sessionData.pageTitle}`);
            return { success: true, title: this.sessionData.pageTitle };
        } catch (error) {
            console.error('❌ Navigation failed:', error.message);
            throw error;
        }
    }

    // Ultra-fast search method
    async searchFor(query, searchSelector = null) {
        try {
            await this.ensureSession();
            console.log(`🔍 Fast searching for: "${query}"`);
            
            // Navigate to Google first if not already there
            if (!this.sessionData.currentUrl?.includes('google.com')) {
                await this.navigateTo('https://www.google.com');
                await this.page.waitForTimeout(500); // Brief pause
            }
            
            // Fast search input detection
            let searchInput = null;
            const selectors = ['textarea[name="q"]', 'input[name="q"]'];
            
            for (const selector of selectors) {
                searchInput = await this.page.waitForSelector(selector, { timeout: 2000 }).catch(() => null);
                if (searchInput) {
                    console.log(`✅ Found search input: ${selector}`);
                    break;
                }
            }
            
            if (!searchInput) {
                throw new Error('Search input not found');
            }
            
            // Fast typing
            await searchInput.click();
            await searchInput.fill(query);
            await searchInput.press('Enter');
            
            // Wait for search results
            await this.page.waitForLoadState('domcontentloaded', { timeout: 5000 });
            
            // Update session data
            this.sessionData.currentUrl = this.page.url();
            this.sessionData.pageTitle = await this.page.title();
            
            console.log(`✅ Fast search completed: ${this.sessionData.pageTitle}`);
            
            return {
                success: true,
                query: query,
                url: this.sessionData.currentUrl,
                title: this.sessionData.pageTitle
            };
            
        } catch (error) {
            console.error('❌ Fast search failed:', error.message);
            throw error;
        }
    }

    async ensureSession() {
        if (!this.page || !this.context) {
            await this.createLocalSession();
        }
    }

    async closeSession() {
        try {
            console.log('🔄 Closing fast browser session...');
            
            if (this.page && !this.page.isClosed()) {
                await this.page.close();
            }
            
            if (this.context) {
                await this.context.close();
                
                // Clean up profile
                try {
                    const fs = await import('fs');
                    if (this.profileDir && fs.existsSync(this.profileDir)) {
                        fs.rmSync(this.profileDir, { recursive: true, force: true });
                        console.log(' ✅ Profile cleaned up');
                    }
                } catch (e) {
                    // Ignore cleanup errors
                }
            }
            
            this.isConnected = false;
            this.sessionId = null;
            this.page = null;
            this.context = null;
            this.currentState = 'closed';
            this.profileDir = null;
            
            console.log('✅ Fast browser session closed');
            
        } catch (error) {
            console.error('❌ Failed to close fast session:', error.message);
        }
    }

    async takeScreenshot(filename = null) {
        try {
            if (!this.page) return null;
            
            const screenshot = await this.page.screenshot({ 
                fullPage: false,
                type: 'png'
            });
            
            if (filename) {
                const fs = await import('fs');
                await fs.writeFile(filename, screenshot);
                console.log(`📸 Screenshot saved: ${filename}`);
                return filename;
            }
            
            return screenshot;
            
        } catch (error) {
            console.error('❌ Screenshot failed:', error.message);
            return null;
        }
    }
}

export default BrowserControllerFast;
