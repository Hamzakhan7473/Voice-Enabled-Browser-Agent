import { Browserbase } from '@browserbase/sdk';
import { chromium } from 'playwright';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class BrowserController {
  constructor(options = {}) {
    this.apiKey = process.env.BROWSERBASE_API_KEY;
    this.projectId = process.env.BROWSERBASE_PROJECT_ID;
    
    if (!this.apiKey || !this.projectId) {
      throw new Error('BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID environment variables are required');
    }

    this.browserbase = new Browserbase({
      apiKey: this.apiKey,
      projectId: this.projectId
    });

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

    this.ensureScreenshotsDir();
  }

  async ensureScreenshotsDir() {
    try {
      await fs.ensureDir(this.screenshotsDir);
    } catch (error) {
      console.error('Failed to create screenshots directory:', error);
    }
  }

  async createSession(options = {}) {
    try {
      console.log('🌐 Creating Browserbase session...');
      
      const sessionOptions = {
        projectId: this.projectId,
        ...options
      };

      const session = await this.browserbase.sessions.create(sessionOptions);
      this.sessionId = session.id;
      
      console.log(`✅ Browserbase session created: ${this.sessionId}`);
      
      // Connect Playwright to the Browserbase session
      await this.connectPlaywright();
      
      return session;
    } catch (error) {
      console.error('Failed to create Browserbase session:', error);
      throw error;
    }
  }

  async connectPlaywright() {
    try {
      if (!this.sessionId) {
        throw new Error('No active session to connect to');
      }

      // Get the WebSocket URL for the session
      const session = await this.browserbase.sessions.get(this.sessionId);
      const wsEndpoint = session.wsEndpoint;

      // Connect Playwright to the Browserbase session
      this.browser = await chromium.connectOverCDP(wsEndpoint);
      this.context = this.browser.contexts()[0] || await this.browser.newContext();
      this.page = this.context.pages()[0] || await this.context.newPage();
      
      this.isConnected = true;
      this.sessionData.startTime = new Date().toISOString();
      
      console.log('✅ Connected to Browserbase session via Playwright');
      
      // Set up page event listeners
      this.setupPageListeners();
      
    } catch (error) {
      console.error('Failed to connect Playwright to Browserbase session:', error);
      throw error;
    }
  }

  setupPageListeners() {
    if (!this.page) return;

    this.page.on('load', async () => {
      try {
        const url = this.page.url();
        const title = await this.page.title();
        
        this.sessionData.currentUrl = url;
        this.sessionData.pageTitle = title;
        
        console.log(`📄 Page loaded: ${title} (${url})`);
      } catch (error) {
        console.error('Error handling page load:', error);
      }
    });

    this.page.on('console', (msg) => {
      console.log(`🖥️ Browser console ${msg.type()}: ${msg.text()}`);
    });

    this.page.on('pageerror', (error) => {
      console.error('❌ Page error:', error.message);
    });
  }

  async navigate(url) {
    try {
      if (!this.page) {
        throw new Error('No active page');
      }

      console.log(`🧭 Navigating to: ${url}`);
      
      await this.page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });
      
      this.sessionData.currentUrl = url;
      this.sessionData.pageTitle = await this.page.title();
      
      // Log the action
      this.sessionData.actions.push({
        type: 'navigate',
        url: url,
        timestamp: new Date().toISOString(),
        success: true
      });
      
      return {
        url: this.page.url(),
        title: this.sessionData.pageTitle,
        success: true
      };
    } catch (error) {
      console.error('Navigation failed:', error);
      
      this.sessionData.actions.push({
        type: 'navigate',
        url: url,
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message
      });
      
      throw error;
    }
  }

  async search(query, selector = 'input[type="search"], input[name="q"], input[placeholder*="search" i]') {
    try {
      if (!this.page) {
        throw new Error('No active page');
      }

      console.log(`🔍 Searching for: ${query}`);
      
      // Try to find search input
      const searchInput = await this.page.$(selector);
      if (!searchInput) {
        throw new Error('Search input not found');
      }

      // Clear and fill search input
      await searchInput.clear();
      await searchInput.fill(query);
      
      // Try to submit the search
      await this.page.keyboard.press('Enter');
      
      // Wait for results to load
      await this.page.waitForLoadState('networkidle');
      
      this.sessionData.actions.push({
        type: 'search',
        query: query,
        selector: selector,
        timestamp: new Date().toISOString(),
        success: true
      });
      
      return {
        query: query,
        url: this.page.url(),
        success: true
      };
    } catch (error) {
      console.error('Search failed:', error);
      
      this.sessionData.actions.push({
        type: 'search',
        query: query,
        selector: selector,
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message
      });
      
      throw error;
    }
  }

  async click(selector, index = 0) {
    try {
      if (!this.page) {
        throw new Error('No active page');
      }

      console.log(`🖱️ Clicking: ${selector} (index: ${index})`);
      
      // Get all matching elements
      const elements = await this.page.$$(selector);
      
      if (elements.length === 0) {
        throw new Error(`No elements found for selector: ${selector}`);
      }
      
      if (index >= elements.length) {
        throw new Error(`Index ${index} out of range. Found ${elements.length} elements.`);
      }
      
      const element = elements[index];
      
      // Scroll element into view
      await element.scrollIntoViewIfNeeded();
      
      // Click the element
      await element.click();
      
      // Wait for any navigation or updates
      await this.page.waitForTimeout(1000);
      
      this.sessionData.actions.push({
        type: 'click',
        selector: selector,
        index: index,
        timestamp: new Date().toISOString(),
        success: true
      });
      
      return {
        selector: selector,
        index: index,
        success: true
      };
    } catch (error) {
      console.error('Click failed:', error);
      
      this.sessionData.actions.push({
        type: 'click',
        selector: selector,
        index: index,
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message
      });
      
      throw error;
    }
  }

  async fill(selector, value, fieldType = 'input') {
    try {
      if (!this.page) {
        throw new Error('No active page');
      }

      console.log(`📝 Filling ${fieldType}: ${selector} with "${value}"`);
      
      const element = await this.page.$(selector);
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }
      
      // Clear existing value
      await element.clear();
      
      // Fill with new value
      await element.fill(value);
      
      this.sessionData.actions.push({
        type: 'fill',
        selector: selector,
        value: value,
        fieldType: fieldType,
        timestamp: new Date().toISOString(),
        success: true
      });
      
      return {
        selector: selector,
        value: value,
        success: true
      };
    } catch (error) {
      console.error('Fill failed:', error);
      
      this.sessionData.actions.push({
        type: 'fill',
        selector: selector,
        value: value,
        fieldType: fieldType,
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message
      });
      
      throw error;
    }
  }

  async scroll(direction, amount = 500) {
    try {
      if (!this.page) {
        throw new Error('No active page');
      }

      console.log(`📜 Scrolling ${direction} by ${amount}px`);
      
      let deltaX = 0, deltaY = 0;
      
      switch (direction.toLowerCase()) {
        case 'up':
          deltaY = -amount;
          break;
        case 'down':
          deltaY = amount;
          break;
        case 'left':
          deltaX = -amount;
          break;
        case 'right':
          deltaX = amount;
          break;
        default:
          throw new Error(`Invalid scroll direction: ${direction}`);
      }
      
      await this.page.mouse.wheel(deltaX, deltaY);
      
      this.sessionData.actions.push({
        type: 'scroll',
        direction: direction,
        amount: amount,
        timestamp: new Date().toISOString(),
        success: true
      });
      
      return {
        direction: direction,
        amount: amount,
        success: true
      };
    } catch (error) {
      console.error('Scroll failed:', error);
      
      this.sessionData.actions.push({
        type: 'scroll',
        direction: direction,
        amount: amount,
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message
      });
      
      throw error;
    }
  }

  async takeScreenshot(selector = null, fullPage = false) {
    try {
      if (!this.page) {
        throw new Error('No active page');
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `screenshot_${timestamp}.png`;
      const filepath = path.join(this.screenshotsDir, filename);
      
      let screenshot;
      
      if (selector) {
        console.log(`📸 Taking screenshot of element: ${selector}`);
        const element = await this.page.$(selector);
        if (!element) {
          throw new Error(`Element not found: ${selector}`);
        }
        screenshot = await element.screenshot({ path: filepath });
      } else {
        console.log(`📸 Taking screenshot${fullPage ? ' (full page)' : ''}`);
        screenshot = await this.page.screenshot({ 
          path: filepath,
          fullPage: fullPage 
        });
      }
      
      this.sessionData.screenshots.push({
        filename: filename,
        filepath: filepath,
        selector: selector,
        fullPage: fullPage,
        timestamp: new Date().toISOString()
      });
      
      return {
        filename: filename,
        filepath: filepath,
        success: true
      };
    } catch (error) {
      console.error('Screenshot failed:', error);
      
      this.sessionData.actions.push({
        type: 'screenshot',
        selector: selector,
        fullPage: fullPage,
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message
      });
      
      throw error;
    }
  }

  async extractData(selector = null, dataType = 'text') {
    try {
      if (!this.page) {
        throw new Error('No active page');
      }

      console.log(`📊 Extracting ${dataType} data${selector ? ` from: ${selector}` : ''}`);
      
      let extractedData;
      
      if (selector) {
        const elements = await this.page.$$(selector);
        extractedData = await Promise.all(elements.map(async (element) => {
          switch (dataType) {
            case 'text':
              return await element.textContent();
            case 'html':
              return await element.innerHTML();
            case 'attributes':
              return await element.evaluate(el => {
                const attrs = {};
                for (const attr of el.attributes) {
                  attrs[attr.name] = attr.value;
                }
                return attrs;
              });
            case 'links':
              return await element.evaluate(el => ({
                text: el.textContent,
                href: el.href || el.getAttribute('href')
              }));
            default:
              return await element.textContent();
          }
        }));
      } else {
        // Extract from entire page
        switch (dataType) {
          case 'text':
            extractedData = await this.page.textContent('body');
            break;
          case 'links':
            extractedData = await this.page.$$eval('a', links => 
              links.map(link => ({
                text: link.textContent.trim(),
                href: link.href
              }))
            );
            break;
          case 'images':
            extractedData = await this.page.$$eval('img', images => 
              images.map(img => ({
                src: img.src,
                alt: img.alt,
                title: img.title
              }))
            );
            break;
          default:
            extractedData = await this.page.textContent('body');
        }
      }
      
      this.sessionData.extractedData.push({
        selector: selector,
        dataType: dataType,
        data: extractedData,
        timestamp: new Date().toISOString()
      });
      
      return {
        data: extractedData,
        dataType: dataType,
        selector: selector,
        success: true
      };
    } catch (error) {
      console.error('Data extraction failed:', error);
      
      this.sessionData.actions.push({
        type: 'extract',
        selector: selector,
        dataType: dataType,
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message
      });
      
      throw error;
    }
  }

  async wait(selector = null, timeout = 5000, condition = 'visible') {
    try {
      if (!this.page) {
        throw new Error('No active page');
      }

      console.log(`⏳ Waiting for ${condition}${selector ? `: ${selector}` : ''}`);
      
      if (selector) {
        switch (condition) {
          case 'visible':
            await this.page.waitForSelector(selector, { state: 'visible', timeout });
            break;
          case 'hidden':
            await this.page.waitForSelector(selector, { state: 'hidden', timeout });
            break;
          case 'attached':
            await this.page.waitForSelector(selector, { state: 'attached', timeout });
            break;
          case 'detached':
            await this.page.waitForSelector(selector, { state: 'detached', timeout });
            break;
          default:
            await this.page.waitForSelector(selector, { timeout });
        }
      } else {
        await this.page.waitForTimeout(timeout);
      }
      
      this.sessionData.actions.push({
        type: 'wait',
        selector: selector,
        timeout: timeout,
        condition: condition,
        timestamp: new Date().toISOString(),
        success: true
      });
      
      return {
        selector: selector,
        timeout: timeout,
        condition: condition,
        success: true
      };
    } catch (error) {
      console.error('Wait failed:', error);
      
      this.sessionData.actions.push({
        type: 'wait',
        selector: selector,
        timeout: timeout,
        condition: condition,
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message
      });
      
      throw error;
    }
  }

  async getPageInfo() {
    try {
      if (!this.page) {
        throw new Error('No active page');
      }

      const url = this.page.url();
      const title = await this.page.title();
      const viewport = this.page.viewportSize();
      
      // Get page elements for context
      const elements = await this.page.$$eval('input, button, a, select, textarea', elements => 
        elements.map(el => ({
          tag: el.tagName.toLowerCase(),
          type: el.type || null,
          text: el.textContent?.trim() || null,
          placeholder: el.placeholder || null,
          id: el.id || null,
          className: el.className || null
        }))
      );
      
      return {
        url: url,
        title: title,
        viewport: viewport,
        elements: elements,
        sessionId: this.sessionId,
        isConnected: this.isConnected
      };
    } catch (error) {
      console.error('Failed to get page info:', error);
      throw error;
    }
  }

  async closeSession() {
    try {
      if (this.sessionId) {
        await this.browserbase.sessions.delete(this.sessionId);
        console.log(`🗑️ Browserbase session closed: ${this.sessionId}`);
      }
      
      if (this.browser) {
        await this.browser.close();
      }
      
      this.isConnected = false;
      this.sessionId = null;
      this.browser = null;
      this.context = null;
      this.page = null;
      
    } catch (error) {
      console.error('Failed to close session:', error);
      throw error;
    }
  }

  getSessionData() {
    return {
      ...this.sessionData,
      sessionId: this.sessionId,
      isConnected: this.isConnected,
      endTime: new Date().toISOString()
    };
  }
}

export default BrowserController;
