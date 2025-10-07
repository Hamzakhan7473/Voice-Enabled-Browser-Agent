/**
 * Tool Executor - Reliable Playwright actions with proper error handling
 */

import type { Page } from 'playwright';
import type { ToolCall, ToolResult } from './types.js';
import { 
  extractArticle, 
  extractTables, 
  extractLinks 
} from './dom-summarizer.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export class ToolExecutor {
  private screenshotCounter = 0;
  private screenshotsDir: string;

  constructor(
    private page: Page,
    config: { screenshotsDir?: string } = {}
  ) {
    this.screenshotsDir = config.screenshotsDir || './screenshots';
  }

  async execute(toolCall: ToolCall): Promise<ToolResult> {
    try {
      switch (toolCall.name) {
        case 'navigate':
          return await this.navigate(toolCall.args);
        case 'click':
          return await this.click(toolCall.args);
        case 'type':
          return await this.type(toolCall.args);
        case 'extract':
          return await this.extract(toolCall.args);
        case 'waitFor':
          return await this.waitFor(toolCall.args);
        case 'screenshot':
          return await this.screenshot(toolCall.args);
        case 'scroll':
          return await this.scroll(toolCall.args);
        case 'query':
          return await this.query(toolCall.args);
        case 'goBack':
          return await this.goBack();
        case 'complete':
          return { success: true, data: toolCall.args };
        default:
          return { success: false, error: `Unknown tool: ${(toolCall as any).name}` };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  private async navigate(args: { url: string; waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' }): Promise<ToolResult> {
    const waitUntil = args.waitUntil || 'domcontentloaded';
    
    await this.page.goto(args.url, { 
      waitUntil,
      timeout: 30000 
    });
    
    return { 
      success: true, 
      data: { 
        url: this.page.url(), 
        title: await this.page.title() 
      } 
    };
  }

  private async click(args: { selector: string; timeout?: number }): Promise<ToolResult> {
    const timeout = args.timeout || 15000;
    const selector = args.selector;
    
    // Wait for element to be visible and stable
    await this.page.waitForSelector(selector, { 
      state: 'visible', 
      timeout 
    });
    
    // Click with retry
    await this.page.click(selector, { timeout });
    
    // Give page time to react
    await this.page.waitForTimeout(500);
    
    return { 
      success: true, 
      data: { selector, clicked: true },
      selector 
    };
  }

  private async type(args: { selector: string; text: string; submit?: boolean; clear?: boolean }): Promise<ToolResult> {
    const { selector, text, submit = false, clear = true } = args;
    
    await this.page.waitForSelector(selector, { 
      state: 'visible', 
      timeout: 15000 
    });
    
    if (clear) {
      await this.page.fill(selector, '');
    }
    
    await this.page.type(selector, text, { delay: 50 });
    
    if (submit) {
      await this.page.keyboard.press('Enter');
      await this.page.waitForTimeout(1000); // Wait for submission
    }
    
    return { 
      success: true, 
      data: { selector, text, submitted: submit },
      selector 
    };
  }

  private async extract(args: { mode: 'article' | 'table' | 'raw' | 'links' }): Promise<ToolResult> {
    let data: any;
    
    switch (args.mode) {
      case 'article':
        data = await extractArticle(this.page);
        break;
      case 'table':
        data = await extractTables(this.page);
        break;
      case 'links':
        data = await extractLinks(this.page);
        break;
      case 'raw':
        data = await this.page.evaluate(() => document.body?.innerText || '');
        break;
    }
    
    return { success: true, data };
  }

  private async waitFor(args: { selector?: string; state?: 'networkidle' | 'load' | 'domcontentloaded'; timeout?: number }): Promise<ToolResult> {
    const timeout = args.timeout || 30000;
    
    if (args.selector) {
      await this.page.waitForSelector(args.selector, { timeout });
      return { success: true, data: { selector: args.selector, appeared: true } };
    } else if (args.state) {
      await this.page.waitForLoadState(args.state, { timeout });
      return { success: true, data: { state: args.state, ready: true } };
    } else {
      return { success: false, error: 'Must specify selector or state' };
    }
  }

  private async screenshot(args: { purpose?: string; fullPage?: boolean }): Promise<ToolResult> {
    await fs.mkdir(this.screenshotsDir, { recursive: true });
    
    const filename = `step-${this.screenshotCounter++}-${Date.now()}.png`;
    const filepath = path.join(this.screenshotsDir, filename);
    
    await this.page.screenshot({ 
      path: filepath, 
      fullPage: args.fullPage || false 
    });
    
    return { 
      success: true, 
      data: { purpose: args.purpose, path: filepath },
      screenshot: filepath 
    };
  }

  private async scroll(args: { direction: 'down' | 'up' | 'top' | 'bottom'; amount?: number }): Promise<ToolResult> {
    await this.page.evaluate((opts) => {
      const amount = opts.amount || window.innerHeight;
      
      switch (opts.direction) {
        case 'down':
          window.scrollBy(0, amount);
          break;
        case 'up':
          window.scrollBy(0, -amount);
          break;
        case 'top':
          window.scrollTo(0, 0);
          break;
        case 'bottom':
          window.scrollTo(0, document.body.scrollHeight);
          break;
      }
    }, args);
    
    await this.page.waitForTimeout(500); // Let content load
    
    return { success: true, data: { direction: args.direction } };
  }

  private async query(args: { selector: string }): Promise<ToolResult> {
    const element = await this.page.$(args.selector);
    
    if (!element) {
      return { success: false, error: `Element not found: ${args.selector}` };
    }
    
    const text = await element.innerText().catch(() => '');
    const visible = await element.isVisible().catch(() => false);
    
    return { 
      success: true, 
      data: { 
        selector: args.selector, 
        text, 
        visible 
      } 
    };
  }

  private async goBack(): Promise<ToolResult> {
    await this.page.goBack({ waitUntil: 'domcontentloaded' });
    
    return { 
      success: true, 
      data: { 
        url: this.page.url() 
      } 
    };
  }
}

