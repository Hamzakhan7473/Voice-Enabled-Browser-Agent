import BrowserController from '../browser/BrowserController.js';
import ContextManager from '../context/ContextManager.js';
import ErrorHandler from '../utils/ErrorHandler.js';
import { EventEmitter } from 'events';
import path from 'path';

class CommandExecutor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.browserController = options.browserController || new BrowserController();
    this.contextManager = options.contextManager || new ContextManager();
    this.errorHandler = options.errorHandler || new ErrorHandler();
    this.executionHistory = [];
    this.isExecuting = false;
  }

  async executeIntent(intent, socket = null) {
    if (this.isExecuting) {
      throw new Error('Another command is currently being executed');
    }

    this.isExecuting = true;
    const executionId = this.generateExecutionId();
    
    try {
      console.log(`🎯 Executing intent: ${intent.intent}`);
      
      // Emit execution start
      if (socket) {
        socket.emit('execution-started', {
          executionId,
          intent: intent.intent,
          parameters: intent.parameters
        });
      }

      // Check if confirmation is required
      if (intent.requiresConfirmation) {
        const confirmed = await this.requestConfirmation(intent, socket);
        if (!confirmed) {
          throw new Error('Command execution cancelled by user');
        }
      }

      // Execute the command based on intent
      const result = await this.executeCommand(intent);
      
      // Update context with execution result
      await this.contextManager.updateContext(intent, result);
      
      // Log execution
      this.executionHistory.push({
        executionId,
        intent,
        result,
        timestamp: new Date().toISOString(),
        success: true
      });

      // Emit execution completion
      if (socket) {
        socket.emit('execution-completed', {
          executionId,
          intent: intent.intent,
          result,
          success: true
        });
      }

      return result;
    } catch (error) {
      console.error(`❌ Command execution failed:`, error);
      
      // Log failed execution
      this.executionHistory.push({
        executionId,
        intent,
        error: error.message,
        timestamp: new Date().toISOString(),
        success: false
      });

      // Emit execution error
      if (socket) {
        socket.emit('execution-error', {
          executionId,
          intent: intent.intent,
          error: error.message,
          success: false
        });
      }

      // Handle error recovery
      await this.handleErrorRecovery(intent, error, socket);
      
      throw error;
    } finally {
      this.isExecuting = false;
    }
  }

  async executeCommand(intent) {
    const { intent: commandType, parameters } = intent;
    
    switch (commandType) {
      case 'search':
        return await this.executeSearch(parameters);
      
      case 'click':
        return await this.executeClick(parameters);
      
      case 'navigate':
        return await this.executeNavigate(parameters);
      
      case 'fill':
        return await this.executeFill(parameters);
      
      case 'scroll':
        return await this.executeScroll(parameters);
      
      case 'extract':
        return await this.executeExtract(parameters);
      
      case 'screenshot':
        return await this.executeScreenshot(parameters);
      
      case 'wait':
        return await this.executeWait(parameters);
      
      case 'sort':
        return await this.executeSort(parameters);
      
      case 'filter':
        return await this.executeFilter(parameters);
      
      case 'click':
        return await this.executeClick(parameters);
      
      case 'type':
        return await this.executeType(parameters);
      
      case 'hover':
        return await this.executeHover(parameters);
      
      case 'book_flight':
        return await this.executeBookFlight(parameters);
      
      case 'shop_online':
        return await this.executeShopOnline(parameters);
      
      case 'fill_form':
        return await this.executeFillForm(parameters);
      
                    case 'multi_step':
                        return await this.executeMultiStep(parameters);
                    
                    case 'clarify_flight':
                        return await this.executeClarifyFlight(parameters);
                    
                    case 'confirm':
                        return await this.executeConfirm(parameters);
                    
                    case 'cancel':
                        return await this.executeCancel(parameters);
      
      // Advanced browser control commands
      case 'type':
        return await this.executeType(parameters);
      
      case 'select':
        return await this.executeSelect(parameters);
      
      case 'hover':
        return await this.executeHover(parameters);
      
      case 'drag':
        return await this.executeDrag(parameters);
      
      case 'swipe':
        return await this.executeSwipe(parameters);
      
      case 'key':
        return await this.executeKey(parameters);
      
      case 'refresh':
        return await this.executeRefresh(parameters);
      
      case 'back':
        return await this.executeBack(parameters);
      
      case 'forward':
        return await this.executeForward(parameters);
      
      case 'zoom':
        return await this.executeZoom(parameters);
      
      case 'tab':
        return await this.executeTab(parameters);
      
      case 'download':
        return await this.executeDownload(parameters);
      
      case 'upload':
        return await this.executeUpload(parameters);
      
      case 'evaluate':
        return await this.executeEvaluate(parameters);
      
      case 'find':
        return await this.executeFind(parameters);
      
      case 'select_all':
        return await this.executeSelectAll(parameters);
      
      case 'copy':
        return await this.executeCopy(parameters);
      
      case 'paste':
        return await this.executePaste(parameters);
      
      case 'cut':
        return await this.executeCut(parameters);
      
      case 'unknown':
        return await this.executeUnknown(parameters);
      case 'clarify':
        return await this.executeClarify(parameters);
      default:
        console.warn(`Unknown command type: ${commandType}`);
        return {
          success: false,
          error: `Unknown command type: ${commandType}`,
          message: `I don't understand the command "${commandType}". Please try a different command.`,
          suggestion: 'Try commands like "search for", "click on", "navigate to", or "extract data from"'
        };
    }
  }

  async executeSearch(parameters) {
    let { query, selector, site } = parameters;
    
    if (!query) {
      throw new Error('Search query is required');
    }

    // If a specific site is mentioned, navigate there first
    if (site) {
      const siteUrl = this.getSiteUrl(site);
      if (siteUrl) {
        console.log(`🌐 Navigating to ${site} first...`);
        try {
          await this.browserController.navigateTo(siteUrl);
          // Minimal wait - let page load in background
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.log(`⚠️ Failed to navigate to ${site}, trying Google search instead...`);
          // Fallback to Google search if specific site fails
          await this.browserController.navigateTo('https://www.google.com');
          await new Promise(resolve => setTimeout(resolve, 500));
          // Modify the query to include the site name
          query = `${query} site:${site.toLowerCase()}.com`;
        }
      }
    } else {
      // No specific site mentioned, go to Google
      console.log(`🌐 Navigating to Google for search...`);
      await this.browserController.navigateTo('https://www.google.com');
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Try to find search input if selector not provided
    let searchSelector = selector;
    if (!searchSelector) {
      const pageInfo = await this.browserController.getPageInfo();
      const searchInputs = pageInfo.elements.filter(el => 
        el.tag === 'input' && 
        (el.type === 'search' || 
         el.placeholder?.toLowerCase().includes('search') ||
         el.id?.toLowerCase().includes('search') ||
         el.className?.toLowerCase().includes('search'))
      );
      
      if (searchInputs.length > 0) {
        searchSelector = `#${searchInputs[0].id}` || 
                        `input[placeholder*="${searchInputs[0].placeholder}"]` ||
                        'input[type="search"]';
      } else {
        searchSelector = 'input[type="search"], input[name="q"], input[placeholder*="search" i]';
      }
    }

    try {
      const result = await this.browserController.searchFor(query, searchSelector);
      return result;
    } catch (error) {
      // Handle CAPTCHA errors
      if (error.captchaDetected) {
        return {
          success: false,
          task: 'search',
          parameters: { query, site },
          error: error.message,
          message: error.message,
          captchaDetected: true,
          captchaType: error.captchaType,
          requiresManualSolving: error.requiresManualSolving,
          clarification: true
        };
      }
      
      // Handle browser session errors
      if (error.message.includes('Browser session lost')) {
        return {
          success: false,
          task: 'search',
          parameters: { query, site },
          error: error.message,
          message: 'Browser session was lost. Please try again.',
          sessionLost: true,
          clarification: true
        };
      }
      
      // Handle other errors
      return {
        success: false,
        task: 'search',
        parameters: { query, site },
        error: error.message,
        message: `Search failed: ${error.message}`
      };
    }
  }

  getSiteUrl(site) {
    const siteMap = {
      'amazon': 'https://www.amazon.com',
      'google': 'https://www.google.com',
      'youtube': 'https://www.youtube.com',
      'wikipedia': 'https://www.wikipedia.org',
      'twitter': 'https://twitter.com',
      'facebook': 'https://www.facebook.com',
      'instagram': 'https://www.instagram.com',
      'linkedin': 'https://www.linkedin.com',
      'github': 'https://github.com',
      'stackoverflow': 'https://stackoverflow.com',
      'reddit': 'https://www.reddit.com',
      'ebay': 'https://www.ebay.com',
      'walmart': 'https://www.walmart.com',
      'target': 'https://www.target.com',
      'best buy': 'https://www.bestbuy.com',
      'netflix': 'https://www.netflix.com',
      'spotify': 'https://www.spotify.com',
      'gmail': 'https://mail.google.com',
      'outlook': 'https://outlook.live.com',
      'yahoo': 'https://www.yahoo.com'
    };
    
    return siteMap[site.toLowerCase()] || null;
  }

  async executeClick(parameters) {
    const { selector, index = 0 } = parameters;
    
    if (!selector) {
      throw new Error('Click selector is required');
    }

    // Try to resolve selector if it's text-based
    const resolvedSelector = await this.resolveTextSelector(selector);
    
    return await this.browserController.clickElement(resolvedSelector, { index });
  }

  async executeNavigate(parameters) {
    const { url, action } = parameters;
    
    if (action) {
      switch (action.toLowerCase()) {
        case 'back':
          await this.browserController.page.goBack();
          return { action: 'back', success: true };
        case 'forward':
          await this.browserController.page.goForward();
          return { action: 'forward', success: true };
        case 'refresh':
          await this.browserController.page.reload();
          return { action: 'refresh', success: true };
        default:
          throw new Error(`Unknown navigation action: ${action}`);
      }
    }
    
    if (!url) {
      throw new Error('URL or action is required for navigation');
    }

        return await this.browserController.navigateTo(url);
  }

  async executeFill(parameters) {
    const { selector, value, fieldType = 'input' } = parameters;
    
    if (!selector || !value) {
      throw new Error('Selector and value are required for fill command');
    }

    // Try to resolve selector if it's text-based
    const resolvedSelector = await this.resolveTextSelector(selector);
    
    return await this.browserController.fillField(resolvedSelector, value);
  }

  async executeScroll(parameters) {
    const { direction, amount = 500 } = parameters;
    
    if (!direction) {
      throw new Error('Scroll direction is required');
    }

    return await this.browserController.scrollPage(direction, amount);
  }

  async executeExtract(parameters) {
    const { selector, dataType = 'text', format = 'json' } = parameters;
    
    try {
      // Check if browserController has the extractData method
      if (!this.browserController || typeof this.browserController.extractData !== 'function') {
        throw new Error('BrowserController extractData method not available');
      }
      
      const result = await this.browserController.extractData(selector, { dataType });
      
      // Format the data if requested
      if (format === 'csv' && Array.isArray(result.data)) {
        result.formattedData = this.formatAsCSV(result.data);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Extract data failed:', error);
      return {
        success: false,
        error: error.message,
        message: `Failed to extract data: ${error.message}`
      };
    }
  }

  async executeScreenshot(parameters) {
    const { selector, fullPage = false } = parameters;
    
    return await this.browserController.takeScreenshot(selector, fullPage);
  }

  async executeWait(parameters) {
    const { selector, timeout = 5000, condition = 'visible' } = parameters;
    
    return await this.browserController.waitForElement(selector, timeout);
  }

  async executeSort(parameters) {
    const { selector, criteria, order = 'ascending' } = parameters;
    
    if (!selector || !criteria) {
      throw new Error('Selector and criteria are required for sort command');
    }

    // This would require custom implementation based on the page structure
    // For now, we'll emit an event that the frontend can handle
    return {
      action: 'sort',
      selector,
      criteria,
      order,
      message: 'Sort functionality requires custom implementation based on page structure',
      success: true
    };
  }

  async executeFilter(parameters) {
    const { selector, criteria, value } = parameters;
    
    if (!selector || !criteria || !value) {
      throw new Error('Selector, criteria, and value are required for filter command');
    }

    // This would require custom implementation based on the page structure
    return {
      action: 'filter',
      selector,
      criteria,
      value,
      message: 'Filter functionality requires custom implementation based on page structure',
      success: true
    };
  }

  async executeConfirm(parameters) {
    const { action, message } = parameters;
    
    return {
      action: 'confirm',
      message: message || `Confirming: ${action}`,
      success: true
    };
  }

  async executeCancel(parameters) {
    const { action } = parameters;
    
    return {
      action: 'cancel',
      message: action ? `Cancelling: ${action}` : 'Action cancelled',
      success: true
    };
  }

  async resolveTextSelector(textSelector) {
    try {
      const pageInfo = await this.browserController.getPageInfo();
      
      // Look for elements that match the text
      const matchingElements = pageInfo.elements.filter(el => 
        el.text?.toLowerCase().includes(textSelector.toLowerCase()) ||
        el.placeholder?.toLowerCase().includes(textSelector.toLowerCase())
      );
      
      if (matchingElements.length > 0) {
        const element = matchingElements[0];
        
        // Generate CSS selector
        if (element.id) {
          return `#${element.id}`;
        } else if (element.text) {
          return `text="${element.text}"`;
        } else if (element.placeholder) {
          return `[placeholder="${element.placeholder}"]`;
        }
      }
      
      // Fallback to original selector
      return textSelector;
    } catch (error) {
      console.warn('Failed to resolve text selector:', error);
      return textSelector;
    }
  }

  async requestConfirmation(intent, socket) {
    return new Promise((resolve) => {
      if (!socket) {
        // If no socket, assume confirmed for CLI usage
        resolve(true);
        return;
      }

      const confirmationData = {
        intent: intent.intent,
        parameters: intent.parameters,
        riskLevel: intent.riskLevel,
        originalText: intent.originalText
      };

      socket.emit('confirmation-required', confirmationData);
      
      // Set up confirmation listener
      const confirmationHandler = (response) => {
        socket.off('confirmation-response', confirmationHandler);
        resolve(response.confirmed);
      };
      
      socket.on('confirmation-response', confirmationHandler);
      
      // Timeout after 30 seconds
      setTimeout(() => {
        socket.off('confirmation-response', confirmationHandler);
        resolve(false);
      }, 30000);
    });
  }

  async handleErrorRecovery(intent, error, socket) {
    try {
      const recoveryStrategy = this.errorHandler.getRecoveryStrategy(intent, error);
      
      if (recoveryStrategy === 'retry') {
        console.log('🔄 Retrying command...');
        await this.executeIntent(intent, socket);
      } else if (recoveryStrategy === 'fallback') {
        console.log('🔄 Attempting fallback strategy...');
        const fallbackIntent = this.errorHandler.getFallbackIntent(intent);
        if (fallbackIntent) {
          await this.executeIntent(fallbackIntent, socket);
        }
      } else if (recoveryStrategy === 'clarify') {
        if (socket) {
          socket.emit('clarification-needed', {
            intent: intent.intent,
            error: error.message,
            suggestions: this.errorHandler.getClarificationSuggestions(intent)
          });
        }
      }
    } catch (recoveryError) {
      console.error('Error recovery failed:', recoveryError);
    }
  }

  formatAsCSV(data) {
    if (!Array.isArray(data) || data.length === 0) {
      return '';
    }

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') 
          ? `"${value}"` 
          : value;
      });
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  }

  generateExecutionId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getExecutionHistory() {
    return this.executionHistory;
  }

  getLastExecution() {
    return this.executionHistory[this.executionHistory.length - 1];
  }

  clearExecutionHistory() {
    this.executionHistory = [];
  }

  // Advanced browser control methods
  async executeType(parameters) {
    const { text, selector } = parameters;
    
    if (!text) {
      throw new Error('Text to type is required');
    }

    if (selector) {
      const resolvedSelector = await this.resolveTextSelector(selector);
      await this.browserController.page.click(resolvedSelector);
      await this.browserController.page.fill(resolvedSelector, text);
    } else {
      // Type at current focus
      await this.browserController.page.keyboard.type(text);
    }

    return { action: 'type', text, selector, success: true };
  }

  async executeSelect(parameters) {
    const { selector, options, multiple = false } = parameters;
    
    if (!selector || !options) {
      throw new Error('Selector and options are required for select command');
    }

    const resolvedSelector = await this.resolveTextSelector(selector);
    await this.browserController.page.selectOption(resolvedSelector, options, { multiple });

    return { action: 'select', selector, options, multiple, success: true };
  }

  async executeHover(parameters) {
    const { selector } = parameters;
    
    if (!selector) {
      throw new Error('Selector is required for hover command');
    }

    const resolvedSelector = await this.resolveTextSelector(selector);
    await this.browserController.page.hover(resolvedSelector);

    return { action: 'hover', selector, success: true };
  }

  async executeDrag(parameters) {
    const { fromSelector, toSelector, steps = 10 } = parameters;
    
    if (!fromSelector || !toSelector) {
      throw new Error('From and to selectors are required for drag command');
    }

    const fromResolved = await this.resolveTextSelector(fromSelector);
    const toResolved = await this.resolveTextSelector(toSelector);
    
    await this.browserController.page.dragAndDrop(fromResolved, toResolved, { steps });

    return { action: 'drag', fromSelector, toSelector, success: true };
  }

  async executeSwipe(parameters) {
    const { direction, distance = 300 } = parameters;
    
    if (!direction) {
      throw new Error('Direction is required for swipe command');
    }

    const page = this.browserController.page;
    const viewport = page.viewportSize();
    const centerX = viewport.width / 2;
    const centerY = viewport.height / 2;

    let startX = centerX, startY = centerY;
    let endX = centerX, endY = centerY;

    switch (direction.toLowerCase()) {
      case 'left':
        startX = centerX + distance / 2;
        endX = centerX - distance / 2;
        break;
      case 'right':
        startX = centerX - distance / 2;
        endX = centerX + distance / 2;
        break;
      case 'up':
        startY = centerY + distance / 2;
        endY = centerY - distance / 2;
        break;
      case 'down':
        startY = centerY - distance / 2;
        endY = centerY + distance / 2;
        break;
      default:
        throw new Error(`Invalid swipe direction: ${direction}`);
    }

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 10 });
    await page.mouse.up();

    return { action: 'swipe', direction, distance, success: true };
  }

  async executeKey(parameters) {
    const { key, selector } = parameters;
    
    if (!key) {
      throw new Error('Key is required for key command');
    }

    if (selector) {
      const resolvedSelector = await this.resolveTextSelector(selector);
      await this.browserController.page.click(resolvedSelector);
    }

    await this.browserController.page.keyboard.press(key);

    return { action: 'key', key, selector, success: true };
  }

  async executeRefresh(parameters) {
    await this.browserController.page.reload();
    return { action: 'refresh', success: true };
  }

  async executeBack(parameters) {
    await this.browserController.page.goBack();
    return { action: 'back', success: true };
  }

  async executeForward(parameters) {
    await this.browserController.page.goForward();
    return { action: 'forward', success: true };
  }

  async executeZoom(parameters) {
    const { level = 1 } = parameters;
    
    await this.browserController.page.evaluate((zoomLevel) => {
      document.body.style.zoom = zoomLevel;
    }, level);

    return { action: 'zoom', level, success: true };
  }

  async executeTab(parameters) {
    const { action = 'new' } = parameters;
    
    const page = this.browserController.page;
    
    switch (action.toLowerCase()) {
      case 'new':
        await page.context().newPage();
        return { action: 'tab', operation: 'new', success: true };
      case 'close':
        await page.close();
        return { action: 'tab', operation: 'close', success: true };
      case 'next':
        // This would require more complex tab management
        return { action: 'tab', operation: 'next', message: 'Tab switching requires custom implementation', success: true };
      default:
        throw new Error(`Unknown tab action: ${action}`);
    }
  }

  async executeDownload(parameters) {
    const { selector, filename } = parameters;
    
    if (!selector) {
      throw new Error('Selector is required for download command');
    }

    const resolvedSelector = await this.resolveTextSelector(selector);
    
    const [download] = await Promise.all([
      this.browserController.page.waitForEvent('download'),
      this.browserController.page.click(resolvedSelector)
    ]);

    const downloadPath = filename ? 
      path.join(process.cwd(), 'downloads', filename) : 
      path.join(process.cwd(), 'downloads', download.suggestedFilename());
    
    await download.saveAs(downloadPath);

    return { action: 'download', path: downloadPath, success: true };
  }

  async executeUpload(parameters) {
    const { selector, filePath } = parameters;
    
    if (!selector || !filePath) {
      throw new Error('Selector and file path are required for upload command');
    }

    const resolvedSelector = await this.resolveTextSelector(selector);
    await this.browserController.page.setInputFiles(resolvedSelector, filePath);

    return { action: 'upload', filePath, success: true };
  }

  async executeEvaluate(parameters) {
    const { expression, args = [] } = parameters;
    
    if (!expression) {
      throw new Error('Expression is required for evaluate command');
    }

    const result = await this.browserController.page.evaluate(expression, ...args);

    return { action: 'evaluate', expression, result, success: true };
  }

  async executeFind(parameters) {
    const { text, caseSensitive = false, wholeWord = false } = parameters;
    
    if (!text) {
      throw new Error('Text to find is required');
    }

    const page = this.browserController.page;
    
    // Use browser's find functionality
    await page.keyboard.press('Control+f'); // or 'Meta+f' for Mac
    await page.keyboard.type(text);

    return { action: 'find', text, caseSensitive, wholeWord, success: true };
  }

  async executeSelectAll(parameters) {
    await this.browserController.page.keyboard.press('Control+a'); // or 'Meta+a' for Mac
    return { action: 'select_all', success: true };
  }

  async executeCopy(parameters) {
    await this.browserController.page.keyboard.press('Control+c'); // or 'Meta+c' for Mac
    return { action: 'copy', success: true };
  }

  async executePaste(parameters) {
    await this.browserController.page.keyboard.press('Control+v'); // or 'Meta+v' for Mac
    return { action: 'paste', success: true };
  }

  async executeCut(parameters) {
    await this.browserController.page.keyboard.press('Control+x'); // or 'Meta+x' for Mac
    return { action: 'cut', success: true };
  }

  async executeClick(parameters) {
    const { selector, options = {} } = parameters;
    
    if (!selector) {
      throw new Error('Selector is required for click command');
    }
    
    return await this.browserController.clickElement(selector, options);
  }

  async executeType(parameters) {
    const { selector, text, options = {} } = parameters;
    
    if (!selector || !text) {
      throw new Error('Selector and text are required for type command');
    }
    
    return await this.browserController.typeText(selector, text, options);
  }

  async executeHover(parameters) {
    const { selector, options = {} } = parameters;
    
    if (!selector) {
      throw new Error('Selector is required for hover command');
    }
    
    return await this.browserController.hoverElement(selector, options);
  }

  // Helper function to parse natural language dates
  parseNaturalDate(dateString) {
    if (!dateString) return null;
    
    const months = {
      'january': '01', 'february': '02', 'march': '03', 'april': '04',
      'may': '05', 'june': '06', 'july': '07', 'august': '08',
      'september': '09', 'october': '10', 'november': '11', 'december': '12'
    };
    
    const ordinalNumbers = {
      'first': '1', 'second': '2', 'third': '3', 'fourth': '4', 'fifth': '5',
      'sixth': '6', 'seventh': '7', 'eighth': '8', 'ninth': '9', 'tenth': '10',
      'eleventh': '11', 'twelfth': '12', 'thirteenth': '13', 'fourteenth': '14',
      'fifteenth': '15', 'sixteenth': '16', 'seventeenth': '17', 'eighteenth': '18',
      'nineteenth': '19', 'twentieth': '20', 'twenty-first': '21', 'twenty-second': '22',
      'twenty-third': '23', 'twenty-fourth': '24', 'twenty-fifth': '25', 'twenty-sixth': '26',
      'twenty-seventh': '27', 'twenty-eighth': '28', 'twenty-ninth': '29', 'thirtieth': '30',
      'thirty-first': '31'
    };
    
    const dateStr = dateString.toLowerCase().trim();
    const currentYear = new Date().getFullYear();
    
    // Handle formats like "December 10", "Dec 10", "10 December"
    const monthMatch = dateStr.match(/(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})/);
    if (monthMatch) {
      const month = months[monthMatch[1]] || months[monthMatch[1].substring(0, 3)];
      const day = monthMatch[2].padStart(2, '0');
      return `${currentYear}-${month}-${day}`;
    }
    
    // Handle formats like "fifth October", "10th October"
    const ordinalMatch = dateStr.match(/(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth|twenty-first|twenty-second|twenty-third|twenty-fourth|twenty-fifth|twenty-sixth|twenty-seventh|twenty-eighth|twenty-ninth|thirtieth|thirty-first|\d{1,2}(?:st|nd|rd|th)?)\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
    if (ordinalMatch) {
      const dayStr = ordinalMatch[1];
      const day = ordinalNumbers[dayStr] || dayStr.replace(/\D/g, '');
      const month = months[ordinalMatch[2]] || months[ordinalMatch[2].substring(0, 3)];
      return `${currentYear}-${month}-${day.padStart(2, '0')}`;
    }
    
    // Handle formats like "10/12", "12-10", "10.12"
    const numericMatch = dateStr.match(/(\d{1,2})[\/\-\.](\d{1,2})/);
    if (numericMatch) {
      const day = numericMatch[1].padStart(2, '0');
      const month = numericMatch[2].padStart(2, '0');
      return `${currentYear}-${month}-${day}`;
    }
    
    return dateString; // Return original if can't parse
  }

  async executeBookFlight(parameters) {
    const { origin, destination, departure_date, return_date, passengers = 1, class: flightClass = 'economy' } = parameters;
    
    // Validate required parameters
    if (!origin || !destination) {
      return {
        success: false,
        task: 'book_flight',
        error: 'Missing required parameters: origin and destination are required',
        message: 'I need to know where you want to fly from and to. Please specify both origin and destination cities.',
        clarification: true
      };
    }
    
    console.log(`✈️ Starting flight booking process: ${origin} → ${destination}`);
    
    // Parse natural language dates
    const parsedDepartureDate = this.parseNaturalDate(departure_date);
    const parsedReturnDate = this.parseNaturalDate(return_date);
    
    console.log(`📅 Parsed dates - Departure: ${parsedDepartureDate}, Return: ${parsedReturnDate}`);
    
    try {
      // Step 1: Navigate to a flight booking site
      await this.browserController.navigateTo('https://www.google.com/flights');
      
      // Wait for page to load
      await this.browserController.page.waitForLoadState('networkidle');
      
      // Wait for page to fully load and get all available inputs
      await this.browserController.page.waitForLoadState('networkidle');
      
      // Get all input elements on the page for debugging
      const allInputs = await this.browserController.page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        return inputs.map(input => ({
          type: input.type,
          placeholder: input.placeholder,
          'aria-label': input.getAttribute('aria-label'),
          'data-testid': input.getAttribute('data-testid'),
          'jsname': input.getAttribute('jsname'),
          className: input.className,
          id: input.id
        }));
      });
      
      console.log('🔍 Available inputs on Google Flights:', allInputs);
      
      // Step 2: Fill departure city - try multiple selectors with better detection
      const departureSelectors = [
        'input[aria-label*="Departure"]',
        'input[aria-label*="From"]',
        'input[placeholder*="Departure"]',
        'input[placeholder*="From"]',
        'input[placeholder*="Where from"]',
        '[data-testid="departure-input"]',
        'input[jsname="YPqjbf"]',
        'input[type="text"]:first-of-type',
        'input[autocomplete="off"]:first-of-type'
      ];
      
      let departureFilled = false;
      for (const selector of departureSelectors) {
        try {
          // Check if element exists before trying to type
          const element = await this.browserController.page.$(selector);
          if (element) {
            await this.browserController.typeText(selector, origin);
            departureFilled = true;
            console.log(`✅ Successfully filled departure with selector: ${selector}`);
            break;
          }
        } catch (error) {
          console.log(`❌ Failed to fill departure with selector: ${selector}`);
        }
      }
      
      if (!departureFilled) {
        // Try to click on the first input and type
        try {
          await this.browserController.page.click('input[type="text"]:first-of-type');
          await this.browserController.page.keyboard.type(origin);
          departureFilled = true;
          console.log('✅ Filled departure using click and type method');
        } catch (error) {
          console.log('❌ Failed to fill departure with click method');
        }
      }
      
      if (!departureFilled) {
        throw new Error('Could not find departure city input field');
      }
      
      // Wait a moment for the departure field to process
      await this.browserController.page.waitForTimeout(1000);
      
      // Step 3: Fill destination city - try multiple selectors with better detection
      const destinationSelectors = [
        'input[aria-label*="Destination"]',
        'input[aria-label*="To"]',
        'input[placeholder*="Destination"]',
        'input[placeholder*="To"]',
        'input[placeholder*="Where to"]',
        '[data-testid="destination-input"]',
        'input[jsname="YPqjbf"]',
        'input[type="text"]:nth-of-type(2)',
        'input[autocomplete="off"]:nth-of-type(2)'
      ];
      
      let destinationFilled = false;
      for (const selector of destinationSelectors) {
        try {
          // Check if element exists before trying to type
          const element = await this.browserController.page.$(selector);
          if (element) {
            await this.browserController.typeText(selector, destination);
            destinationFilled = true;
            console.log(`✅ Successfully filled destination with selector: ${selector}`);
            break;
          }
        } catch (error) {
          console.log(`❌ Failed to fill destination with selector: ${selector}`);
        }
      }
      
      if (!destinationFilled) {
        // Try to click on the second input and type
        try {
          await this.browserController.page.click('input[type="text"]:nth-of-type(2)');
          await this.browserController.page.keyboard.type(destination);
          destinationFilled = true;
          console.log('✅ Filled destination using click and type method');
        } catch (error) {
          console.log('❌ Failed to fill destination with click method');
        }
      }
      
      if (!destinationFilled) {
        throw new Error('Could not find destination city input field');
      }
      
      // Step 4: Select dates if provided
      if (parsedDepartureDate) {
        console.log(`📅 Setting departure date: ${parsedDepartureDate}`);
        const dateSelectors = [
          'input[aria-label*="Departure date"]',
          'input[aria-label*="Date"]',
          'input[placeholder*="Date"]',
          'input[placeholder*="Departure"]',
          '[data-testid="departure-date"]',
          'input[type="date"]:first-of-type'
        ];
        
        let dateFilled = false;
        for (const selector of dateSelectors) {
          try {
            const element = await this.browserController.page.$(selector);
            if (element) {
              await this.browserController.typeText(selector, parsedDepartureDate);
              dateFilled = true;
              console.log(`✅ Successfully filled departure date with selector: ${selector}`);
              break;
            }
          } catch (error) {
            console.log(`❌ Failed to fill departure date with selector: ${selector}`);
          }
        }
        
        if (!dateFilled) {
          console.log('⚠️ Could not find departure date field, continuing...');
        }
      }
      
      if (parsedReturnDate) {
        console.log(`📅 Setting return date: ${parsedReturnDate}`);
        const returnDateSelectors = [
          'input[aria-label*="Return date"]',
          'input[aria-label*="Return"]',
          'input[placeholder*="Return"]',
          '[data-testid="return-date"]',
          'input[type="date"]:nth-of-type(2)'
        ];
        
        let returnDateFilled = false;
        for (const selector of returnDateSelectors) {
          try {
            const element = await this.browserController.page.$(selector);
            if (element) {
              await this.browserController.typeText(selector, parsedReturnDate);
              returnDateFilled = true;
              console.log(`✅ Successfully filled return date with selector: ${selector}`);
              break;
            }
          } catch (error) {
            console.log(`❌ Failed to fill return date with selector: ${selector}`);
          }
        }
        
        if (!returnDateFilled) {
          console.log('⚠️ Could not find return date field, continuing...');
        }
      }
      
      // Step 5: Search for flights
      const searchSelectors = [
        'button[aria-label*="Search"]',
        'button[data-testid="search-button"]',
        'button:contains("Search")',
        '[jsname="VkJw6"]'
      ];
      
      for (const selector of searchSelectors) {
        try {
          await this.browserController.clickElement(selector);
          break;
        } catch (error) {
          console.log(`Failed to click search with selector: ${selector}`);
        }
      }
      
      return {
        success: true,
        task: 'book_flight',
        parameters: { origin, destination, departure_date, return_date, passengers, flightClass },
        message: `Flight search completed for ${origin} to ${destination}`,
        requiresConfirmation: true
      };
    } catch (error) {
      console.error('❌ Flight booking failed:', error);
      return {
        success: false,
        task: 'book_flight',
        error: error.message,
        message: `Flight booking failed: ${error.message}`
      };
    }
  }

  async executeShopOnline(parameters) {
    const { product, max_price, brand, quantity = 1 } = parameters;
    
    console.log(`🛒 Starting online shopping for: ${product}`);
    
    try {
      // Step 1: Navigate to Amazon
      await this.browserController.navigateTo('https://www.amazon.com');
      
      // Step 2: Search for the product
      await this.browserController.typeText('#twotabsearchtextbox', product);
      await this.browserController.clickElement('#nav-search-submit-button');
      
      // Step 3: Apply price filter if specified
      if (max_price) {
        await this.browserController.typeText('input[name="low-price"]', '0');
        await this.browserController.typeText('input[name="high-price"]', max_price.toString());
        await this.browserController.clickElement('input[aria-label="Go"]');
      }
      
      // Step 4: Apply brand filter if specified
      if (brand) {
        await this.browserController.clickElement(`span:contains("${brand}")`);
      }
      
      // Step 5: Sort by price or rating
      await this.browserController.clickElement('#s-result-sort-select');
      await this.browserController.clickElement('option[value="price-asc-rank"]');
      
      return {
        success: true,
        task: 'shop_online',
        parameters: { product, max_price, brand, quantity },
        message: `Shopping search completed for ${product}`,
        requiresConfirmation: true
      };
    } catch (error) {
      console.error('❌ Shopping failed:', error);
      return {
        success: false,
        task: 'shop_online',
        error: error.message,
        message: `Shopping failed: ${error.message}`
      };
    }
  }

  async executeFillForm(parameters) {
    const { form_type, fields } = parameters;
    
    console.log(`📝 Starting form filling process: ${form_type}`);
    
    return {
      success: true,
      task: 'fill_form',
      parameters: { form_type, fields },
      message: `Form filling process initiated for ${form_type}`,
      requiresConfirmation: true
    };
  }

  async executeMultiStep(parameters) {
    const { task_description, steps } = parameters;
    
    console.log(`🔄 Starting multi-step task: ${task_description}`);
    
    return {
      success: true,
      task: 'multi_step',
      parameters: { task_description, steps },
      message: `Multi-step task initiated: ${task_description}`,
      requiresConfirmation: true
    };
  }

  async executeClarifyFlight(parameters) {
    const { message } = parameters;
    
    console.log(`❓ Flight booking clarification: ${message}`);
    
    return {
      success: true,
      task: 'clarify_flight',
      parameters: { message },
      message: message,
      requiresConfirmation: false,
      clarification: true
    };
  }

  async executeUnknown(parameters) {
    const { message, suggestion } = parameters;
    
    console.log(`❓ Unknown command: ${message}`);
    
    return {
      success: false,
      task: 'unknown',
      parameters: { message, suggestion },
      message: message || 'I don\'t understand that command.',
      suggestion: suggestion || 'Try commands like "search for", "click on", "navigate to", or "extract data from"',
      clarification: true
    };
  }

  async executeClarify(parameters) {
    const { message, options } = parameters;
    
    console.log(`❓ Clarification needed: ${message}`);
    
    return {
      success: true,
      task: 'clarify',
      parameters: { message, options },
      message: message,
      options: options || [],
      clarification: true
    };
  }
}

export default CommandExecutor;
