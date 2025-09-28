import axios from 'axios';
import { chromium } from 'playwright';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class BrowserController extends EventEmitter {
    constructor(options = {}) {
        super();
        this.apiKey = process.env.BROWSERBASE_API_KEY;
        this.projectId = process.env.BROWSERBASE_PROJECT_ID;
        
        if (!this.apiKey || !this.projectId) {
            throw new Error('BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID environment variables are required');
        }

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
            timeout: parseInt(process.env.BROWSER_TIMEOUT) || 30000,
            headless: process.env.BROWSER_HEADLESS === 'true',
            viewport: {
                width: parseInt(process.env.BROWSER_VIEWPORT_WIDTH) || 1920,
                height: parseInt(process.env.BROWSER_VIEWPORT_HEIGHT) || 1080
            },
            ...options
        };

        this.eventListeners = new Map();
        this.retryCount = 0;
        this.maxRetries = 3;
    }

    // Enhanced session management
    async ensureSession() {
        if (!this.isConnected || !this.page || this.page.isClosed()) {
            console.log('🔄 Session lost, recreating...');
            await this.createLocalSession();
        }
    }

    // Enhanced searchFor with better error handling
    async searchFor(query, searchSelector = null) {
        try {
            await this.ensureSession();
            
            if (!this.page) {
                throw new Error('No active page');
            }

            console.log(`🔍 Searching for: "${query}"`);
            
            // Navigate to Google if not already there
            const currentUrl = this.page.url();
            if (!currentUrl.includes('google.com')) {
                console.log('🌐 Navigating to Google for search...');
                await this.navigateTo('https://www.google.com');
            }

            // Wait for page to be ready
            await this.page.waitForLoadState('domcontentloaded', { timeout: 5000 });
            
            // Enhanced selector strategy
            const selectors = [
                'textarea[name="q"]', // Primary Google search
                'input[name="q"]',
                'input[aria-label*="Search"]',
                'input[placeholder*="Search"]',
                'input[type="search"]',
                'textarea[aria-label*="Search"]',
                'input[role="searchbox"]',
                'textarea[role="searchbox"]'
            ];

            let usedSelector = null;
            for (const selector of selectors) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 2000 });
                    usedSelector = selector;
                    console.log(`✅ Found search input: ${selector}`);
                    break;
                } catch (error) {
                    console.log(`❌ Selector not found: ${selector}`);
                    continue;
                }
            }

            if (!usedSelector) {
                throw new Error('No search input found on page');
            }

            // Clear existing text and type new query
            await this.page.fill(usedSelector, '');
            await this.page.waitForTimeout(100);
            await this.page.type(usedSelector, query, { delay: 30 });
            
            // Press Enter
            await this.page.press(usedSelector, 'Enter');
            
            // Wait for results
            await this.page.waitForLoadState('domcontentloaded', { timeout: 10000 });
            
            // Check for CAPTCHA
            const captchaResult = await this.handleCaptcha();
            if (!captchaResult.success) {
                throw new Error(`CAPTCHA detected: ${captchaResult.message}`);
            }

            // Update session data
            this.sessionData.currentUrl = this.page.url();
            this.sessionData.pageTitle = await this.page.title();
            this.sessionData.actions.push({
                type: 'search',
                query: query,
                timestamp: Date.now(),
                url: this.sessionData.currentUrl
            });

            console.log(`✅ Search completed: ${this.sessionData.currentUrl}`);
            
            return {
                success: true,
                query: query,
                url: this.sessionData.currentUrl,
                title: this.sessionData.pageTitle
            };

        } catch (error) {
            console.error('❌ Search failed:', error);
            
            // Retry logic
            if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                console.log(`🔄 Retrying search (attempt ${this.retryCount}/${this.maxRetries})...`);
                await this.page.waitForTimeout(2000);
                return await this.searchFor(query, searchSelector);
            }
            
            throw error;
        }
    }

    // Enhanced CAPTCHA detection
    async detectCaptcha() {
        try {
            const captchaSelectors = [
                'iframe[src*="recaptcha"]',
                'div[class*="recaptcha"]',
                'div[id*="recaptcha"]',
                '.g-recaptcha',
                '#g-recaptcha',
                '[data-sitekey]',
                'iframe[src*="hcaptcha"]',
                'div[class*="hcaptcha"]',
                'div[id*="hcaptcha"]',
                '.h-captcha',
                '#h-captcha',
                'div[class*="captcha"]',
                'div[id*="captcha"]',
                'img[alt*="captcha"]',
                'img[src*="captcha"]',
                'input[placeholder*="captcha"]',
                'input[name*="captcha"]',
                'div[class*="cf-challenge"]',
                'div[id*="cf-challenge"]',
                '.cf-browser-verification',
                'iframe[src*="challenges.cloudflare.com"]'
            ];

            for (const selector of captchaSelectors) {
                try {
                    const element = await this.page.$(selector);
                    if (element && await element.isVisible()) {
                        let captchaType = 'Generic CAPTCHA';
                        if (selector.includes('recaptcha')) captchaType = 'reCAPTCHA';
                        else if (selector.includes('hcaptcha')) captchaType = 'hCaptcha';
                        else if (selector.includes('cf-challenge')) captchaType = 'Cloudflare Challenge';
                        
                        return { detected: true, type: captchaType, selector };
                    }
                } catch (e) {
                    continue;
                }
            }

            return { detected: false };
        } catch (error) {
            console.error('❌ CAPTCHA detection failed:', error);
            return { detected: false };
        }
    }

    // Enhanced CAPTCHA handling
    async handleCaptcha() {
        try {
            const captchaInfo = await this.detectCaptcha();
            
            if (!captchaInfo.detected) {
                return { success: true, message: 'No CAPTCHA detected' };
            }
            
            console.log(`🚨 CAPTCHA detected: ${captchaInfo.type}`);
            
            return {
                success: false,
                message: `CAPTCHA detected: ${captchaInfo.type}. Manual intervention required.`,
                captchaType: captchaInfo.type,
                requiresManualSolving: true
            };
            
        } catch (error) {
            console.error('❌ CAPTCHA handling failed:', error);
            return { success: false, message: `CAPTCHA handling error: ${error.message}` };
        }
    }

    // Enhanced navigation
    async navigateTo(url) {
        try {
            await this.ensureSession();
            
            if (!this.page) {
                throw new Error('No active page');
            }

            console.log(`🌐 Navigating to: ${url}`);
            
            await this.page.goto(url, { 
                waitUntil: 'domcontentloaded',
                timeout: 15000 
            });
            
            this.sessionData.currentUrl = url;
            this.sessionData.pageTitle = await this.page.title();
            
            console.log(`✅ Navigation completed: ${this.sessionData.pageTitle}`);
            
            return {
                success: true,
                url: url,
                title: this.sessionData.pageTitle
            };
            
        } catch (error) {
            console.error('❌ Navigation failed:', error);
            throw error;
        }
    }

    // Enhanced local session creation
    async createLocalSession() {
        try {
            console.log('🚀 Creating local browser session...');
            
            this.browser = await chromium.launch({
                headless: false,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-extensions',
                    '--disable-plugins',
                    '--disable-images',
                    '--disable-javascript',
                    '--disable-default-apps',
                    '--disable-sync',
                    '--disable-translate',
                    '--hide-scrollbars',
                    '--mute-audio',
                    '--no-default-browser-check',
                    '--no-pings',
                    '--password-store=basic',
                    '--use-mock-keychain',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    '--disable-field-trial-config',
                    '--disable-back-forward-cache',
                    '--disable-ipc-flooding-protection',
                    '--disable-hang-monitor',
                    '--disable-prompt-on-repost',
                    '--disable-domain-reliability',
                    '--disable-component-extensions-with-background-pages',
                    '--disable-default-apps',
                    '--disable-extensions',
                    '--disable-features=TranslateUI',
                    '--disable-ipc-flooding-protection',
                    '--disable-renderer-backgrounding',
                    '--disable-sync',
                    '--force-color-profile=srgb',
                    '--metrics-recording-only',
                    '--no-first-run',
                    '--safebrowsing-disable-auto-update',
                    '--enable-automation',
                    '--password-store=basic',
                    '--use-mock-keychain',
                    '--disable-component-update',
                    '--disable-background-networking',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    '--disable-features=TranslateUI,BlinkGenPropertyTrees',
                    '--disable-ipc-flooding-protection',
                    '--disable-hang-monitor',
                    '--disable-prompt-on-repost',
                    '--disable-domain-reliability',
                    '--disable-component-extensions-with-background-pages',
                    '--disable-default-apps',
                    '--disable-extensions',
                    '--disable-features=TranslateUI',
                    '--disable-ipc-flooding-protection',
                    '--disable-renderer-backgrounding',
                    '--disable-sync',
                    '--force-color-profile=srgb',
                    '--metrics-recording-only',
                    '--no-first-run',
                    '--safebrowsing-disable-auto-update',
                    '--enable-automation',
                    '--password-store=basic',
                    '--use-mock-keychain',
                    '--disable-component-update',
                    '--disable-background-networking',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    '--disable-features=TranslateUI,BlinkGenPropertyTrees'
                ]
            });

            this.context = await this.browser.newContext({
                viewport: this.options.viewport,
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                locale: 'en-US',
                timezoneId: 'America/New_York',
                permissions: ['geolocation'],
                extraHTTPHeaders: {
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Upgrade-Insecure-Requests': '1',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Cache-Control': 'max-age=0'
                }
            });

            this.page = await this.context.newPage();
            
            // Enhanced stealth mode
            await this.page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined,
                });
                
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [
                        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
                        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
                        { name: 'Native Client', filename: 'internal-nacl-plugin' }
                    ],
                });
                
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['en-US', 'en'],
                });
                
                Object.defineProperty(navigator, 'hardwareConcurrency', {
                    get: () => 8,
                });
                
                Object.defineProperty(navigator, 'deviceMemory', {
                    get: () => 8,
                });
                
                window.chrome = {
                    runtime: {},
                    loadTimes: function() {},
                    csi: function() {},
                    app: {}
                };
                
                Object.defineProperty(screen, 'availHeight', { get: () => 1055 });
                Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
                Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
                Object.defineProperty(screen, 'height', { get: () => 1080 });
                Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
                Object.defineProperty(screen, 'width', { get: () => 1920 });
            });

            this.sessionId = `local_${Date.now()}`;
            this.isConnected = true;
            this.sessionData.startTime = Date.now();
            
            console.log(`✅ Local browser session created: ${this.sessionId}`);
            
            return {
                success: true,
                sessionId: this.sessionId,
                type: 'local'
            };
            
        } catch (error) {
            console.error('❌ Failed to create local session:', error);
            throw error;
        }
    }

    // Enhanced session closing
    async closeSession() {
        try {
            console.log('🔄 Closing browser session...');
            
            if (this.page && !this.page.isClosed()) {
                await this.page.close();
            }
            
            if (this.context) {
                await this.context.close();
            }
            
            if (this.browser && this.browser.isConnected()) {
                await this.browser.close();
            }
            
            this.isConnected = false;
            this.sessionId = null;
            this.page = null;
            this.context = null;
            this.browser = null;
            this.retryCount = 0;
            
            console.log('✅ Browser session closed successfully');
            
        } catch (error) {
            console.error('❌ Failed to close session:', error);
        }
    }

    // Additional methods for compatibility
    async getPageInfo() {
        try {
            await this.ensureSession();
            
            if (!this.page) {
                return { url: 'No active page', title: 'No active page' };
            }
            
            return {
                url: this.page.url(),
                title: await this.page.title()
            };
        } catch (error) {
            console.error('❌ Failed to get page info:', error);
            return { url: 'Error', title: 'Error' };
        }
    }

    async takeScreenshot(filename = null) {
        try {
            await this.ensureSession();
            
            if (!this.page) {
                throw new Error('No active page');
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const screenshotName = filename || `screenshot_${timestamp}.png`;
            const screenshotPath = path.join(this.screenshotsDir, screenshotName);
            
            const screenshotBuffer = await this.page.screenshot({ 
                type: 'png',
                fullPage: true 
            });
            
            if (filename) {
                await fs.writeFile(screenshotPath, screenshotBuffer);
                this.sessionData.screenshots.push({
                    path: screenshotPath,
                    timestamp: Date.now()
                });
            }
            
            return screenshotBuffer;
            
        } catch (error) {
            console.error('❌ Failed to take screenshot:', error);
            throw error;
        }
    }
}

export default BrowserController;
