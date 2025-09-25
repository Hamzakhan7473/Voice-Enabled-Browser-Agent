import axios from 'axios';
import { chromium } from 'playwright';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class BrowserController {
    constructor(options = {}) {
        this.apiKey = process.env.BROWSERBASE_API_KEY;
        this.projectId = process.env.BROWSERBASE_PROJECT_ID;
        
        if (!this.apiKey || !this.projectId) {
            throw new Error('BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID environment variables are required');
        }

        this.browserbaseApiUrl = 'https://www.browserbase.com/v1';
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
        this.ensureScreenshotsDir();
    }

    async ensureScreenshotsDir() {
        try {
            await fs.ensureDir(this.screenshotsDir);
        } catch (error) {
            console.error('❌ Failed to create screenshots directory:', error);
        }
    }

    async createSession(options = {}) {
        try {
            console.log('🌐 Creating Browserbase session...');
            
            const sessionOptions = {
                projectId: this.projectId,
                ...options
            };

            const response = await axios.post(
                `${this.browserbaseApiUrl}/sessions`,
                sessionOptions,
                { headers: this.browserbaseHeaders }
            );
            
            this.sessionId = response.data.id;
            
            console.log(`✅ Browserbase session created: ${this.sessionId}`);
            
            // Connect Playwright to the Browserbase session
            await this.connectPlaywright();
            
            return response.data;
        } catch (error) {
            console.error('❌ Failed to create Browserbase session:', error);
            throw error;
        }
    }

    async connectPlaywright() {
        try {
            if (!this.sessionId) {
                throw new Error('No active session to connect to');
            }

            // Get the WebSocket URL for the session
            const response = await axios.get(
                `${this.browserbaseApiUrl}/sessions/${this.sessionId}`,
                { headers: this.browserbaseHeaders }
            );
            
            const wsEndpoint = response.data.wsEndpoint;

            // Connect Playwright to the Browserbase session
            this.browser = await chromium.connectOverCDP(wsEndpoint);
            this.context = this.browser.contexts()[0] || await this.browser.newContext();
            this.page = this.context.pages()[0] || await this.context.newPage();
            
            // Set viewport
            await this.page.setViewportSize(this.options.viewport);
            
            this.isConnected = true;
            this.sessionData.startTime = new Date();
            
            console.log('✅ Connected to Browserbase session with Playwright');
            this.emit('session-connected', { sessionId: this.sessionId });
            
        } catch (error) {
            console.error('❌ Failed to connect Playwright to Browserbase session:', error);
            throw error;
        }
    }

    async navigateTo(url) {
        try {
            if (!this.page) {
                throw new Error('No active page');
            }

            console.log(`🌐 Navigating to: ${url}`);
            
            await this.page.goto(url, { 
                waitUntil: 'networkidle',
                timeout: this.options.timeout 
            });
            
            const currentUrl = this.page.url();
            const pageTitle = await this.page.title();
            
            this.sessionData.currentUrl = currentUrl;
            this.sessionData.pageTitle = pageTitle;
            this.sessionData.actions.push({
                type: 'navigate',
                url: url,
                timestamp: Date.now()
            });
            
            console.log(`✅ Navigated to: ${currentUrl}`);
            this.emit('page-loaded', { url: currentUrl, title: pageTitle });
            
            return { url: currentUrl, title: pageTitle };
            
        } catch (error) {
            console.error('❌ Failed to navigate:', error);
            throw error;
        }
    }

    async clickElement(selector, options = {}) {
        try {
            if (!this.page) {
                throw new Error('No active page');
            }

            console.log(`🖱️ Clicking element: ${selector}`);
            
            await this.page.click(selector, options);
            
            this.sessionData.actions.push({
                type: 'click',
                selector: selector,
                timestamp: Date.now()
            });
            
            console.log(`✅ Clicked element: ${selector}`);
            this.emit('action-completed', { type: 'click', selector });
            
            return { success: true, selector };
            
        } catch (error) {
            console.error('❌ Failed to click element:', error);
            throw error;
        }
    }

    async fillField(selector, value) {
        try {
            if (!this.page) {
                throw new Error('No active page');
            }

            console.log(`📝 Filling field: ${selector} with "${value}"`);
            
            await this.page.fill(selector, value);
            
            this.sessionData.actions.push({
                type: 'fill',
                selector: selector,
                value: value,
                timestamp: Date.now()
            });
            
            console.log(`✅ Filled field: ${selector}`);
            this.emit('action-completed', { type: 'fill', selector, value });
            
            return { success: true, selector, value };
            
        } catch (error) {
            console.error('❌ Failed to fill field:', error);
            throw error;
        }
    }

    async searchFor(query, searchSelector = 'input[type="search"], input[name="q"], input[placeholder*="search" i]') {
        try {
            if (!this.page) {
                throw new Error('No active page');
            }

            console.log(`🔍 Searching for: "${query}"`);
            
            // Try to find search input
            const searchInput = await this.page.$(searchSelector);
            if (!searchInput) {
                throw new Error('No search input found');
            }
            
            await this.page.fill(searchSelector, query);
            await this.page.press(searchSelector, 'Enter');
            
            // Wait for search results
            await this.page.waitForLoadState('networkidle');
            
            this.sessionData.actions.push({
                type: 'search',
                query: query,
                timestamp: Date.now()
            });
            
            console.log(`✅ Searched for: "${query}"`);
            this.emit('action-completed', { type: 'search', query });
            
            return { success: true, query };
            
        } catch (error) {
            console.error('❌ Failed to search:', error);
            throw error;
        }
    }

    async scrollPage(direction = 'down', amount = 500) {
        try {
            if (!this.page) {
                throw new Error('No active page');
            }

            console.log(`📜 Scrolling ${direction} by ${amount}px`);
            
            if (direction === 'down') {
                await this.page.evaluate((amount) => window.scrollBy(0, amount), amount);
            } else if (direction === 'up') {
                await this.page.evaluate((amount) => window.scrollBy(0, -amount), amount);
            }
            
            this.sessionData.actions.push({
                type: 'scroll',
                direction: direction,
                amount: amount,
                timestamp: Date.now()
            });
            
            console.log(`✅ Scrolled ${direction}`);
            this.emit('action-completed', { type: 'scroll', direction, amount });
            
            return { success: true, direction, amount };
            
        } catch (error) {
            console.error('❌ Failed to scroll:', error);
            throw error;
        }
    }

    async takeScreenshot(filename = null) {
        try {
            if (!this.page) {
                throw new Error('No active page');
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const screenshotName = filename || `screenshot_${timestamp}.png`;
            const screenshotPath = path.join(this.screenshotsDir, screenshotName);
            
            console.log('📸 Taking screenshot...');
            
            await this.page.screenshot({ 
                path: screenshotPath,
                fullPage: true 
            });
            
            this.sessionData.screenshots.push({
                path: screenshotPath,
                timestamp: Date.now()
            });
            
            console.log(`✅ Screenshot saved: ${screenshotPath}`);
            this.emit('screenshot-taken', { path: screenshotPath });
            
            return screenshotPath;
            
        } catch (error) {
            console.error('❌ Failed to take screenshot:', error);
            throw error;
        }
    }

    async extractPageData() {
        try {
            if (!this.page) {
                throw new Error('No active page');
            }

            console.log('📊 Extracting page data...');
            
            const pageData = await this.page.evaluate(() => {
                return {
                    title: document.title,
                    url: window.location.href,
                    headings: Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => ({
                        tag: h.tagName,
                        text: h.textContent.trim(),
                        level: parseInt(h.tagName.charAt(1))
                    })),
                    links: Array.from(document.querySelectorAll('a[href]')).map(a => ({
                        text: a.textContent.trim(),
                        href: a.href
                    })),
                    images: Array.from(document.querySelectorAll('img[src]')).map(img => ({
                        src: img.src,
                        alt: img.alt,
                        title: img.title
                    })),
                    forms: Array.from(document.querySelectorAll('form')).map(form => ({
                        action: form.action,
                        method: form.method,
                        inputs: Array.from(form.querySelectorAll('input, textarea, select')).map(input => ({
                            type: input.type,
                            name: input.name,
                            placeholder: input.placeholder,
                            required: input.required
                        }))
                    })),
                    tables: Array.from(document.querySelectorAll('table')).map(table => {
                        const rows = Array.from(table.querySelectorAll('tr'));
                        return {
                            headers: rows[0] ? Array.from(rows[0].querySelectorAll('th, td')).map(cell => cell.textContent.trim()) : [],
                            rows: rows.slice(1).map(row => 
                                Array.from(row.querySelectorAll('td')).map(cell => cell.textContent.trim())
                            )
                        };
                    })
                };
            });
            
            this.sessionData.extractedData.push({
                data: pageData,
                timestamp: Date.now()
            });
            
            console.log('✅ Page data extracted');
            this.emit('data-extracted', { data: pageData });
            
            return pageData;
            
        } catch (error) {
            console.error('❌ Failed to extract page data:', error);
            throw error;
        }
    }

    async waitForElement(selector, timeout = 10000) {
        try {
            if (!this.page) {
                throw new Error('No active page');
            }

            console.log(`⏳ Waiting for element: ${selector}`);
            
            await this.page.waitForSelector(selector, { timeout });
            
            console.log(`✅ Element found: ${selector}`);
            return true;
            
        } catch (error) {
            console.error(`❌ Element not found: ${selector}`, error);
            throw error;
        }
    }

    async getElementText(selector) {
        try {
            if (!this.page) {
                throw new Error('No active page');
            }

            const text = await this.page.textContent(selector);
            console.log(`📄 Element text: ${text}`);
            
            return text;
            
        } catch (error) {
            console.error('❌ Failed to get element text:', error);
            throw error;
        }
    }

    async closeSession() {
        try {
            if (this.page) {
                await this.page.close();
            }
            
            if (this.context) {
                await this.context.close();
            }
            
            if (this.browser) {
                await this.browser.close();
            }
            
            if (this.sessionId) {
                await axios.delete(
                    `${this.browserbaseApiUrl}/sessions/${this.sessionId}`,
                    { headers: this.browserbaseHeaders }
                );
            }
            
            this.isConnected = false;
            this.sessionId = null;
            this.page = null;
            this.context = null;
            this.browser = null;
            
            console.log('✅ Browser session closed');
            this.emit('session-closed');
            
        } catch (error) {
            console.error('❌ Failed to close session:', error);
            throw error;
        }
    }

    getStatus() {
        return {
            isConnected: this.isConnected,
            sessionId: this.sessionId,
            currentUrl: this.sessionData.currentUrl,
            pageTitle: this.sessionData.pageTitle,
            actionsCount: this.sessionData.actions.length,
            screenshotsCount: this.sessionData.screenshots.length,
            extractedDataCount: this.sessionData.extractedData.length
        };
    }

    getSessionData() {
        return this.sessionData;
    }

    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    emit(event, ...args) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    console.error(`❌ Error in event listener for ${event}:`, error);
                }
            });
        }
    }
}