/**
 * DOM Summarizer - Clean, token-efficient page understanding
 * Uses Mozilla Readability + smart selector extraction
 */

import type { Page } from 'playwright';
import type { ExtractedContent, SelectorInfo } from './types.js';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

/**
 * Summarize page content for LLM consumption (keep it under 3k chars)
 */
export async function summarizeDOM(page: Page): Promise<string> {
  const url = page.url();
  const title = await page.title().catch(() => 'Untitled');
  
  // Get main headings
  const headings = await page.evaluate(() => {
    const h1s = Array.from(document.querySelectorAll('h1')).map(h => h.textContent?.trim()).filter(Boolean);
    const h2s = Array.from(document.querySelectorAll('h2')).map(h => h.textContent?.trim()).filter(Boolean);
    return { h1s: h1s.slice(0, 3), h2s: h2s.slice(0, 5) };
  });

  // Get key visible text (first 2000 chars)
  const mainText = await page.evaluate(() => {
    const body = document.body;
    if (!body) return '';
    
    // Remove script, style, hidden elements
    const clone = body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('script, style, [hidden], [style*="display: none"]').forEach(el => el.remove());
    
    return clone.innerText?.slice(0, 2000) || '';
  });

  // Build concise summary
  let summary = `URL: ${url}\nTitle: ${title}\n\n`;
  
  if (headings.h1s.length > 0) {
    summary += `Main Headings:\n${headings.h1s.map(h => `  - ${h}`).join('\n')}\n\n`;
  }
  
  if (headings.h2s.length > 0) {
    summary += `Subheadings:\n${headings.h2s.map(h => `  - ${h}`).join('\n')}\n\n`;
  }
  
  summary += `Content Preview:\n${mainText.slice(0, 1000)}...\n`;
  
  return summary.slice(0, 3000); // Hard limit
}

/**
 * Extract stable, actionable selectors from the page
 * Prioritize data-testid, role attributes, and unique text
 */
export async function extractStableSelectors(page: Page): Promise<SelectorInfo[]> {
  return await page.evaluate(() => {
    const selectors: SelectorInfo[] = [];
    
    // Helper to get stable selector for an element
    function getStableSelector(el: Element): string | null {
      // Prefer data-testid
      const testId = el.getAttribute('data-testid') || el.getAttribute('data-test-id');
      if (testId) return `[data-testid="${testId}"]`;
      
      // Then aria-label
      const ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel) return `[aria-label="${ariaLabel}"]`;
      
      // Then id (if not auto-generated looking)
      const id = el.id;
      if (id && !/^[a-z0-9-]{20,}$/i.test(id) && !id.includes('random')) {
        return `#${id}`;
      }
      
      // Then unique name
      const name = el.getAttribute('name');
      if (name) {
        const similars = document.querySelectorAll(`[name="${name}"]`);
        if (similars.length === 1) return `[name="${name}"]`;
      }
      
      return null;
    }
    
    // Buttons
    document.querySelectorAll('button, [role="button"], input[type="submit"]').forEach(el => {
      const selector = getStableSelector(el);
      const text = (el.textContent || (el as HTMLInputElement).value || '').trim();
      const role = el.getAttribute('role') || 'button';
      
      if (selector && text) {
        selectors.push({
          selector,
          type: 'button',
          text: text.slice(0, 50),
          role
        });
      } else if (text.length > 0 && text.length < 50) {
        // Fallback: use text selector
        selectors.push({
          selector: `text="${text}"`,
          type: 'button',
          text,
          role
        });
      }
    });
    
    // Links
    document.querySelectorAll('a[href]').forEach(el => {
      const selector = getStableSelector(el);
      const text = el.textContent?.trim() || '';
      const href = (el as HTMLAnchorElement).href;
      
      if ((selector || text) && text.length > 0 && text.length < 100) {
        selectors.push({
          selector: selector || `text="${text}"`,
          type: 'link',
          text: text.slice(0, 50)
        });
      }
    });
    
    // Input fields
    document.querySelectorAll('input:not([type="hidden"]), textarea').forEach(el => {
      const selector = getStableSelector(el);
      const placeholder = el.getAttribute('placeholder');
      const label = document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim();
      const type = (el as HTMLInputElement).type || 'text';
      
      if (selector) {
        selectors.push({
          selector,
          type: 'input',
          text: label || placeholder || type,
          role: type
        });
      }
    });
    
    // Forms
    document.querySelectorAll('form').forEach((el, idx) => {
      const selector = getStableSelector(el) || `form:nth-of-type(${idx + 1})`;
      const action = (el as HTMLFormElement).action;
      
      selectors.push({
        selector,
        type: 'form',
        text: action ? `Form → ${action}` : 'Form'
      });
    });
    
    // Limit and dedupe
    const seen = new Set<string>();
    return selectors.filter(s => {
      if (seen.has(s.selector)) return false;
      seen.add(s.selector);
      return true;
    }).slice(0, 30); // Max 30 selectors
  });
}

/**
 * Extract clean article content using Readability
 */
export async function extractArticle(page: Page): Promise<ExtractedContent> {
  const html = await page.content();
  const url = page.url();
  
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  
  if (!article) {
    // Fallback: just get the text
    const textContent = await page.evaluate(() => document.body?.innerText || '');
    return {
      title: await page.title(),
      content: '',
      textContent: textContent.slice(0, 10000),
      length: textContent.length
    };
  }
  
  return {
    title: article.title,
    byline: article.byline || undefined,
    content: article.content,
    textContent: article.textContent.slice(0, 10000),
    excerpt: article.excerpt || undefined,
    length: article.length,
    siteName: article.siteName || undefined
  };
}

/**
 * Extract tables as structured data
 */
export async function extractTables(page: Page): Promise<Array<Record<string, any>[]>> {
  return await page.evaluate(() => {
    const tables: Array<Record<string, any>[]> = [];
    
    document.querySelectorAll('table').forEach(table => {
      const headers: string[] = [];
      const rows: Record<string, any>[] = [];
      
      // Get headers
      table.querySelectorAll('thead th, thead td').forEach(th => {
        headers.push(th.textContent?.trim() || '');
      });
      
      // If no thead, try first row
      if (headers.length === 0) {
        const firstRow = table.querySelector('tr');
        firstRow?.querySelectorAll('th, td').forEach(cell => {
          headers.push(cell.textContent?.trim() || '');
        });
      }
      
      // Get data rows
      table.querySelectorAll('tbody tr, tr').forEach((tr, idx) => {
        if (idx === 0 && headers.length === 0) return; // Skip header row if used
        
        const row: Record<string, any> = {};
        const cells = tr.querySelectorAll('td, th');
        
        cells.forEach((cell, cellIdx) => {
          const key = headers[cellIdx] || `col_${cellIdx}`;
          row[key] = cell.textContent?.trim() || '';
        });
        
        if (Object.keys(row).length > 0) {
          rows.push(row);
        }
      });
      
      if (rows.length > 0) {
        tables.push(rows);
      }
    });
    
    return tables;
  });
}

/**
 * Extract all links with text
 */
export async function extractLinks(page: Page): Promise<Array<{ text: string; href: string }>> {
  return await page.evaluate(() => {
    const links: Array<{ text: string; href: string }> = [];
    
    document.querySelectorAll('a[href]').forEach(a => {
      const text = a.textContent?.trim() || '';
      const href = (a as HTMLAnchorElement).href;
      
      if (text && href && !href.startsWith('javascript:')) {
        links.push({ text: text.slice(0, 100), href });
      }
    });
    
    return links.slice(0, 100); // Max 100 links
  });
}

