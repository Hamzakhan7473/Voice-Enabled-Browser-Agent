import { chromium } from "playwright-core";
import fetch from "node-fetch";

let browser = null;
let context = null;
let page = null;

export async function createBrowserbaseSession() {
  console.log('[BB] Creating session...');
  
  const API_KEY = process.env.BROWSERBASE_API_KEY?.trim();
  const PROJECT_ID = process.env.BROWSERBASE_PROJECT_ID?.trim();
  
  if (!API_KEY) {
    throw new Error('BROWSERBASE_API_KEY is required');
  }
  
  if (!PROJECT_ID) {
    throw new Error('BROWSERBASE_PROJECT_ID is required');
  }

  try {
    const response = await fetch("https://api.browserbase.com/v1/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-BB-API-Key": API_KEY
      },
                  body: JSON.stringify({
                    projectId: PROJECT_ID,
                    keepAlive: false  // Ensure session closes when we disconnect
                  })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Browserbase error ${response.status}: ${text}`);
    }

    const sessionData = await response.json();
    console.log('[BB] Created:', sessionData.id, 'url:', sessionData.connectUrl?.slice(0, 60) + '...');
    
    return sessionData;
  } catch (error) {
    console.error('[BB] Creation failed:', error.message);
    throw error;
  }
}

export async function connectToBrowserbase(sessionData) {
  console.log('[BB] Connecting to:', sessionData.id);
  
  const maxRetries = 3;
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[BB] CDP connect attempt ${attempt}/${maxRetries}...`);
      
      // Connect immediately after create (canonical pattern)
      browser = await chromium.connectOverCDP(sessionData.connectUrl);
      console.log('[BB] Connected to CDP');
      
      // Create fresh context (canonical pattern)
      context = await browser.newContext();
      page = await context.newPage();
      console.log('[BB] Created context and page');
      
      // Basic test to verify connection works
      await page.goto("https://example.com", { waitUntil: 'load', timeout: 15000 });
      console.log('[BB] Test navigation successful, title:', await page.title());
      
      console.log('[BB] Connected successfully!');
      return page;
      
    } catch (error) {
      lastError = error;
      console.error(`[BB] CDP connect attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        console.log(`[BB] Retrying in 1 second...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.error('[BB] All CDP connect attempts failed');
      }
    }
  }
  
  throw lastError; // Let initializeBrowser handle the fallback
}

export async function closeBrowserSession() {
  console.log('[BB] Closing browser session...');
  
  try {
    if (browser) {
      await browser.close();
      console.log('[BB] Browser closed');
      browser = null;
      context = null;
      page = null;
    }
  } catch (error) {
    console.error('[BB] Error closing browser:', error.message);
  }
}

export async function endBrowserbaseSession(sessionId) {
  const API_KEY = process.env.BROWSERBASE_API_KEY?.trim();
  
  console.log(`[BB] Ending session: ${sessionId}`);
  
  try {
    const response = await fetch(`https://api.browserbase.com/v1/sessions/${sessionId}`, {
      method: "DELETE",
      headers: { "X-BB-API-Key": API_KEY }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to end session: ${response.statusText}`);
    }
    
    console.log('[BB] Session ended');
  } catch (error) {
    console.error('[BB] Failed to end session:', error.message);
  }
}

// Initialize browser connection - use local Chrome directly (skip Browserbase for now)
export async function initializeBrowser() {
  console.log('🚀 Initializing browser connection...');
  
  // Use local Chromium only (skip Browserbase)
  console.log('🔄 Using local Chromium only (no Browserbase)...');
  
  try {
    // Skip Browserbase entirely - use local Chromium only
    console.log('🔄 Skipping Browserbase, using local Chromium only...');
  
  // Use separate profile to avoid conflicts
  const fs = await import('fs');
  const path = await import('path');
  const os = await import('os');
  
  // Use a separate profile directory for the agent to avoid conflicts
  const agentProfileDir = path.join(os.homedir(), 'Library/', 'Application Support/', 'Chromium/', 'Agent Profile');
  
  // Ensure profile doesn't exist or clean it
  if (fs.existsSync(agentProfileDir)) {
    // Remove lock files if they exist
    const lockPath = path.join(agentProfileDir, 'SingletonLock');
    if (fs.existsSync(lockPath)) {
      fs.unlinkSync(lockPath);
    }
  }
  
  // Use Playwright's built-in Chromium (more reliable)
  console.log('✅ Using Playwright built-in Chromium');
  let chromeExecutablePath = null; // null = use Playwright's built-in browser
  
  console.log('🌐 Launching Chromium browser...');
  const browserOptions = {
    headless: false,
    timeout: 30000, // Generous timeout
    viewport: { width: 1280, height: 800 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1280,800',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ]
  };

  // Only add executablePath if we have a specific path
  if (chromeExecutablePath) {
    browserOptions.executablePath = chromeExecutablePath;
  }

  browser = await chromium.launchPersistentContext(agentProfileDir, browserOptions);
  
  console.log('📄 Getting default page from persistent context...');
  // With persistent context, we get the default page
  page = browser.pages()[0] || await browser.newPage();
  
  // Ensure the page stays alive and navigate to a default page
  await page.goto('about:blank');
  
  console.log('✅ Using local Chromium with agent profile (isolated from main browser)');
  console.log('🚀 Browser connection successful!');
  
  // Store local session ID for reference
  page._browserbaseSessionId = 'local-playwright';
  
  // Keep the page alive by adding a simple keep-alive mechanism
  page.on('close', () => {
    console.log('⚠️ Page was closed, this should not happen');
  });
  
  return page;
  } catch (error) {
    console.warn('⚠️ Local Chromium setup failed:', error.message);
    throw error;
  }
}

export async function bbGoto(page, url) {
  console.log(`🌐 Navigating to: ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  console.log(`✅ Navigation completed: ${await page.title()}`);
}

export async function bbClick(page, opts) {
  console.log(`🖱️ Clicking: ${opts.selector || `(${opts.x}, ${opts.y})`}`);
  
  if (opts.selector) {
    await page.click(opts.selector, { timeout: 8000 });
  } else {
    await page.mouse.click(opts.x, opts.y);
  }
  
  console.log('✅ Click completed');
}

export async function bbType(page, selector, text) {
  console.log(`⌨️ Typing: "${text}" ${selector ? `into ${selector}` : ''}`);
  
  if (selector) {
    await page.fill(selector, "");
    await page.type(selector, text, { delay: 20 });
  } else {
    await page.keyboard.type(text, { delay: 20 });
  }
  
  console.log('✅ Type completed');
}

export async function bbScroll(page, scrollOptions) {
  console.log(`📜 Scrolling: ${scrollOptions.to || `dx:${scrollOptions.dx} dy:${scrollOptions.dy}`}`);
  
  if (scrollOptions.to) {
    await page.evaluate((to) => {
      if (to === "top") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      }
    }, scrollOptions.to);
  } else {
    await page.mouse.wheel(scrollOptions.dx || 0, scrollOptions.dy || 600);
  }
  
  console.log('✅ Scroll completed');
}

export async function bbWaitFor(page, selector, timeout) {
  console.log(`⏳ Waiting for: ${selector}`);
  await page.waitForSelector(selector, { timeout });
  console.log(`✅ Found: ${selector}`);
}

export async function bbCapture(page) {
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
      const placeholder = el.placeholder || '';
      const ariaLabel = el.getAttribute('aria-label') || '';
      const type = el.type || '';
      
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

export async function disconnect() {
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