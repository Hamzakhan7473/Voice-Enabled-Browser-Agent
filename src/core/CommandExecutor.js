import BrowserController from '../browser/BrowserController.js';
import ContextManager from '../context/ContextManager.js';
import ErrorHandler from '../utils/ErrorHandler.js';

class CommandExecutor {
  constructor(options = {}) {
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
      
      case 'confirm':
        return await this.executeConfirm(parameters);
      
      case 'cancel':
        return await this.executeCancel(parameters);
      
      default:
        throw new Error(`Unknown command type: ${commandType}`);
    }
  }

  async executeSearch(parameters) {
    const { query, selector } = parameters;
    
    if (!query) {
      throw new Error('Search query is required');
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

    return await this.browserController.search(query, searchSelector);
  }

  async executeClick(parameters) {
    const { selector, index = 0 } = parameters;
    
    if (!selector) {
      throw new Error('Click selector is required');
    }

    // Try to resolve selector if it's text-based
    const resolvedSelector = await this.resolveTextSelector(selector);
    
    return await this.browserController.click(resolvedSelector, index);
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

    return await this.browserController.navigate(url);
  }

  async executeFill(parameters) {
    const { selector, value, fieldType = 'input' } = parameters;
    
    if (!selector || !value) {
      throw new Error('Selector and value are required for fill command');
    }

    // Try to resolve selector if it's text-based
    const resolvedSelector = await this.resolveTextSelector(selector);
    
    return await this.browserController.fill(resolvedSelector, value, fieldType);
  }

  async executeScroll(parameters) {
    const { direction, amount = 500 } = parameters;
    
    if (!direction) {
      throw new Error('Scroll direction is required');
    }

    return await this.browserController.scroll(direction, amount);
  }

  async executeExtract(parameters) {
    const { selector, dataType = 'text', format = 'json' } = parameters;
    
    const result = await this.browserController.extractData(selector, dataType);
    
    // Format the data if requested
    if (format === 'csv' && Array.isArray(result.data)) {
      result.formattedData = this.formatAsCSV(result.data);
    }
    
    return result;
  }

  async executeScreenshot(parameters) {
    const { selector, fullPage = false } = parameters;
    
    return await this.browserController.takeScreenshot(selector, fullPage);
  }

  async executeWait(parameters) {
    const { selector, timeout = 5000, condition = 'visible' } = parameters;
    
    return await this.browserController.wait(selector, timeout, condition);
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
}

export default CommandExecutor;
