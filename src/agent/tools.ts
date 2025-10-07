/**
 * OpenAI function tool definitions for the agent
 * These tell the LLM what capabilities it has
 */

export const AGENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'navigate',
      description: 'Navigate to a URL. Use this to go to a new page or website.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to navigate to (must be absolute, starting with http:// or https://)'
          },
          waitUntil: {
            type: 'string',
            enum: ['load', 'domcontentloaded', 'networkidle'],
            description: 'When to consider navigation complete (default: domcontentloaded)'
          }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'click',
      description: 'Click an element on the page. Use stable selectors like data-testid, role, or unique text.',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector, text selector (text=...), or role selector (role=button) to click'
          },
          timeout: {
            type: 'number',
            description: 'Maximum time to wait for element in milliseconds (default: 15000)'
          }
        },
        required: ['selector']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'type',
      description: 'Type text into an input field. Can optionally submit after typing.',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the input field'
          },
          text: {
            type: 'string',
            description: 'Text to type into the field'
          },
          submit: {
            type: 'boolean',
            description: 'Whether to press Enter after typing (default: false)'
          },
          clear: {
            type: 'boolean',
            description: 'Whether to clear the field before typing (default: true)'
          }
        },
        required: ['selector', 'text']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'extract',
      description: 'Extract content from the page in various formats.',
      parameters: {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            enum: ['article', 'table', 'raw', 'links'],
            description: 'article: clean article text | table: structured tables | raw: all text | links: all links with text'
          }
        },
        required: ['mode']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'waitFor',
      description: 'Wait for a condition before proceeding. Use to wait for elements to appear or page to stabilize.',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector to wait for (optional if using state)'
          },
          state: {
            type: 'string',
            enum: ['networkidle', 'load', 'domcontentloaded'],
            description: 'Page load state to wait for (optional if using selector)'
          },
          timeout: {
            type: 'number',
            description: 'Maximum time to wait in milliseconds (default: 30000)'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'screenshot',
      description: 'Take a screenshot of the current page for debugging or verification.',
      parameters: {
        type: 'object',
        properties: {
          purpose: {
            type: 'string',
            description: 'Why this screenshot is being taken'
          },
          fullPage: {
            type: 'boolean',
            description: 'Capture full scrollable page (default: false)'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'scroll',
      description: 'Scroll the page to reveal more content.',
      parameters: {
        type: 'object',
        properties: {
          direction: {
            type: 'string',
            enum: ['down', 'up', 'top', 'bottom'],
            description: 'Direction to scroll'
          },
          amount: {
            type: 'number',
            description: 'Pixels to scroll (default: viewport height)'
          }
        },
        required: ['direction']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'goBack',
      description: 'Navigate back to the previous page in history.',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'complete',
      description: 'Signal that the goal has been achieved (or cannot be achieved). Use this when done.',
      parameters: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            description: 'Whether the goal was successfully completed'
          },
          result: {
            type: 'string',
            description: 'The final result or answer to return to the user'
          },
          reason: {
            type: 'string',
            description: 'Explanation of why stopping (success or failure reason)'
          }
        },
        required: ['success']
      }
    }
  }
];

export const SYSTEM_PROMPT = `You are a production-grade browser automation agent. Your job is to accomplish user goals by intelligently navigating websites, extracting information, and interacting with web pages.

**Your capabilities:**
- Navigate to URLs
- Click buttons and links (use stable selectors: data-testid, role, or specific text)
- Type into input fields and forms
- Extract content (articles, tables, links)
- Wait for elements or network to stabilize
- Scroll to reveal content
- Take screenshots for verification

**Guidelines:**
1. **Plan before acting**: Think through the steps needed to accomplish the goal
2. **Use stable selectors**: Prefer data-testid, role attributes, or unique text over fragile CSS classes
3. **Wait appropriately**: Use waitFor when pages load slowly or elements appear dynamically
4. **Extract when needed**: Use extract to get clean data before analyzing
5. **Be resilient**: If an action fails, try alternative selectors or approaches
6. **Respect the web**: Follow site structure, don't hammer endpoints, respect robots.txt
7. **Safety first**: Never attempt to bypass CAPTCHAs, auth walls, or payment flows without explicit user consent
8. **Summarize smartly**: When observing pages, focus on relevant content only—you see summarized DOM, not raw HTML

**When to complete:**
- Call \`complete(success=true, result=...)\` when you've achieved the goal and have the answer/data
- Call \`complete(success=false, reason=...)\` if the goal is impossible or blocked (CAPTCHA, auth required, etc.)

**Output format:**
- You will see: current URL, page title, key headings, visible interactive elements with selectors
- You respond with: ONE tool call per step
- After each tool, you'll see the result and updated page state

Think step-by-step. Be precise. Be efficient.`;

