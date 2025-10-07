import { chromium, Page } from "playwright-core";

export type Action =
  | { name: "goto"; url: string }
  | { name: "click"; selector?: string; x?: number; y?: number }
  | { name: "type"; text: string; selector?: string }
  | { name: "scroll"; dx?: number; dy?: number; to?: "top" | "bottom" }
  | { name: "wait_for"; selector: string; timeout_ms?: number }
  | { name: "done"; summary?: string };

export interface PageCapture {
  screenshotB64: string;
  domSnippet: string;
  a11yTree: any;
  url: string;
  title: string;
}

let browser: any = null;
let context: any = null;
let page: Page | null = null;

export async function connectToBrowserbase(): Promise<Page> {
  console.log('🌐 Connecting to Browserbase...');
  
  // Use Browserbase CDP endpoint
  const BROWSERBASE_WSS = `wss://connect.browserbase.com/sessions/${process.env.BROWSERBASE_SESSION_ID}?token=${process.env.BROWSERBASE_API_KEY}`;
  
  try {
    browser = await chromium.connectOverCDP(BROWSERBASE_WSS);
    context = browser.contexts()[0] || await browser.newContext();
    page = await context.newPage();
    
    console.log('✅ Connected to Browserbase');
    return page;
  } catch (error) {
    console.error('❌ Browserbase connection failed, falling back to local Chrome');
    
    // Fallback to local Chrome with real profile
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    
    const profileDir = path.join(os.homedir(), '/Library/Application Support/Google/Chrome/Default');
    const chromePaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable'
    ];
    
    let chromeExecutablePath = null;
    for (const chromePath of chromePaths) {
      if (fs.existsSync(chromePath)) {
        chromeExecutablePath = chromePath;
        break;
      }
    }
    
    browser = await chromium.launchPersistentContext(profileDir, {
      executablePath: chromeExecutablePath,
      headless: false,
      args: ['--disable-blink-features=AutomationControlled']
    });
    
    page = await browser.newPage();
    console.log('✅ Using local Chrome with real profile');
    return page;
  }
}

export async function bbGoto(page: Page, url: string): Promise<void> {
  console.log(`🌐 Navigating to: ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  console.log(`✅ Navigation completed: ${await page.title()}`);
}

export async function bbClick(page: Page, opts: { selector?: string; x?: number; y?: number }): Promise<void> {
  console.log(`🖱️ Clicking: ${opts.selector || `(${opts.x}, ${opts.y})`}`);
  
  if (opts.selector) {
    await page.click(opts.selector, { timeout: 8000 });
  } else {
    await page.mouse.click(opts.x!, opts.y!);
  }
  
  console.log('✅ Click completed');
}

export async function bbType(page: Page, selector: string | undefined, text: string): Promise<void> {
  console.log(`⌨️ Typing: "${text}" ${selector ? `into ${selector}` : ''}`);
  
  if (selector) {
    await page.fill(selector, "");
    await page.type(selector, text, { delay: 20 });
  } else {
    await page.keyboard.type(text, { delay: 20 });
  }
  
  console.log('✅ Type completed');
}

export async function bbScroll(page: Page, a: { dx?: number; dy?: number; to?: "top" | "bottom" }): Promise<void> {
  console.log(`📜 Scrolling: ${a.to || `dx:${a.dx} dy:${a.dy}`}`);
  
  if (a.to) {
    await page.evaluate((to) => {
      if (to === "top") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      }
    }, a.to);
  } else {
    await page.mouse.wheel(a.dx ?? 0, a.dy ?? 600);
  }
  
  console.log('✅ Scroll completed');
}

export async function bbWaitFor(page: Page, selector: string, timeout: number): Promise<void> {
  console.log(`⏳ Waiting for: ${selector}`);
  await page.waitForSelector(selector, { timeout });
  console.log(`✅ Found: ${selector}`);
}

export async function bbCapture(page: Page): Promise<PageCapture> {
  console.log('📸 Capturing page state...');
  
  const screenshot = await page.screenshot({ type: "png" });
  const screenshotB64 = screenshot.toString("base64");
  
  // Light DOM snippet for context
  const domSnippet = await page.evaluate(() => {
    // Get form inputs, buttons, links with their labels
    const elements = document.querySelectorAll('input, button, a, [role="button"], [onclick]');
    const snippets = Array.from(elements).slice(0, 20).map(el => {
      const tag = el.tagName.toLowerCase();
      const text = el.textContent?.slice(0, 50) || '';
      const placeholder = (el as any).placeholder || '';
      const ariaLabel = (el as any).getAttribute('aria-label') || '';
      const type = (el as any).type || '';
      
      return `${tag}[${text || placeholder || ariaLabel}${type ? `:${type}` : ''}]`;
    });
    
    return snippets.join('\n') + '\n\n' + document.body.innerText.slice(0, 4000);
  });
  
  const a11yTree = await page.accessibility.snapshot({ interestingOnly: true });
  
  console.log('✅ Page captured');
  
  return {
    screenshotB64,
    domSnippet,
    a11yTree,
    url: page.url(),
    title: await page.title()
  };
}

export async function disconnect(): Promise<void> {
  if (page) {
    await page.close();
  }
  if (context) {
    await context.close();
  }
  if (browser) {
    await browser.close();
  }
  console.log('🔌 Disconnected from browser');
}
