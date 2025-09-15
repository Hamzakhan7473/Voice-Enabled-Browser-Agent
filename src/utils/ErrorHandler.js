class ErrorHandler {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.errorHistory = [];
    this.recoveryStrategies = new Map();
    this.fallbackIntents = new Map();
    this.setupErrorMappings();
  }

  setupErrorMappings() {
    // Define recovery strategies for different error types
    this.recoveryStrategies.set('ELEMENT_NOT_FOUND', 'retry');
    this.recoveryStrategies.set('TIMEOUT', 'retry');
    this.recoveryStrategies.set('NETWORK_ERROR', 'retry');
    this.recoveryStrategies.set('SELECTOR_INVALID', 'fallback');
    this.recoveryStrategies.set('PERMISSION_DENIED', 'clarify');
    this.recoveryStrategies.set('INVALID_INPUT', 'clarify');
    this.recoveryStrategies.set('UNKNOWN_COMMAND', 'clarify');
    this.recoveryStrategies.set('CONNECTION_LOST', 'retry');
    this.recoveryStrategies.set('AUTHENTICATION_FAILED', 'clarify');
    this.recoveryStrategies.set('RATE_LIMITED', 'retry');

    // Define fallback intents for different commands
    this.fallbackIntents.set('click', {
      intent: 'click',
      parameters: { selector: 'button, a, input[type="button"], input[type="submit"]' }
    });
    
    this.fallbackIntents.set('search', {
      intent: 'search',
      parameters: { selector: 'input[type="search"], input[name="q"], input[placeholder*="search" i]' }
    });
    
    this.fallbackIntents.set('fill', {
      intent: 'fill',
      parameters: { selector: 'input, textarea, select' }
    });
  }

  classifyError(error) {
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('element not found') || errorMessage.includes('selector')) {
      return 'ELEMENT_NOT_FOUND';
    } else if (errorMessage.includes('timeout')) {
      return 'TIMEOUT';
    } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      return 'NETWORK_ERROR';
    } else if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
      return 'PERMISSION_DENIED';
    } else if (errorMessage.includes('invalid') || errorMessage.includes('malformed')) {
      return 'INVALID_INPUT';
    } else if (errorMessage.includes('unknown') || errorMessage.includes('unrecognized')) {
      return 'UNKNOWN_COMMAND';
    } else if (errorMessage.includes('auth') || errorMessage.includes('login')) {
      return 'AUTHENTICATION_FAILED';
    } else if (errorMessage.includes('rate limit') || errorMessage.includes('too many')) {
      return 'RATE_LIMITED';
    } else {
      return 'UNKNOWN_ERROR';
    }
  }

  getRecoveryStrategy(intent, error) {
    const errorType = this.classifyError(error);
    const strategy = this.recoveryStrategies.get(errorType);
    
    // Log the error
    this.errorHistory.push({
      timestamp: new Date().toISOString(),
      intent: intent.intent,
      errorType,
      errorMessage: error.message,
      strategy
    });
    
    return strategy || 'clarify';
  }

  getFallbackIntent(intent) {
    return this.fallbackIntents.get(intent.intent);
  }

  getClarificationSuggestions(intent) {
    const suggestions = [];
    
    switch (intent.intent) {
      case 'click':
        suggestions.push(
          'Try specifying the element more clearly (e.g., "click the submit button")',
          'Use a more specific selector (e.g., button text, element ID)',
          'Check if the element is visible on the page'
        );
        break;
      
      case 'search':
        suggestions.push(
          'Make sure there is a search box on the current page',
          'Try different search terms',
          'Check if the search functionality is working'
        );
        break;
      
      case 'fill':
        suggestions.push(
          'Specify which form field to fill (e.g., "fill the email field")',
          'Make sure the form field exists and is editable',
          'Check if the field accepts the type of data you\'re trying to enter'
        );
        break;
      
      case 'navigate':
        suggestions.push(
          'Provide a complete URL (e.g., "https://example.com")',
          'Use navigation actions like "go back" or "refresh page"',
          'Check if the URL is accessible'
        );
        break;
      
      case 'extract':
        suggestions.push(
          'Specify what type of data to extract (text, links, images)',
          'Use a more specific CSS selector',
          'Check if the data exists on the current page'
        );
        break;
      
      default:
        suggestions.push(
          'Try rephrasing your command',
          'Be more specific about what you want to do',
          'Check if the action is supported on the current page'
        );
    }
    
    return suggestions;
  }

  async handleError(error, intent, context = {}) {
    try {
      const errorType = this.classifyError(error);
      const strategy = this.getRecoveryStrategy(intent, error);
      
      console.log(`🔧 Handling error: ${errorType} with strategy: ${strategy}`);
      
      switch (strategy) {
        case 'retry':
          return await this.handleRetry(error, intent, context);
        
        case 'fallback':
          return await this.handleFallback(error, intent, context);
        
        case 'clarify':
          return await this.handleClarification(error, intent, context);
        
        default:
          return await this.handleGenericError(error, intent, context);
      }
    } catch (handlingError) {
      console.error('Error handling failed:', handlingError);
      return {
        success: false,
        error: handlingError.message,
        originalError: error.message,
        strategy: 'failed'
      };
    }
  }

  async handleRetry(error, intent, context = {}) {
    const maxRetries = context.maxRetries || this.maxRetries;
    const retryDelay = context.retryDelay || this.retryDelay;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Retry attempt ${attempt}/${maxRetries} for ${intent.intent}`);
        
        // Wait before retry
        if (attempt > 1) {
          await this.delay(retryDelay * attempt);
        }
        
        // Modify intent for retry if needed
        const retryIntent = this.modifyIntentForRetry(intent, attempt);
        
        return {
          success: true,
          action: 'retry',
          attempt,
          modifiedIntent: retryIntent,
          originalError: error.message
        };
      } catch (retryError) {
        console.log(`❌ Retry attempt ${attempt} failed: ${retryError.message}`);
        
        if (attempt === maxRetries) {
          return {
            success: false,
            action: 'retry_failed',
            attempts: maxRetries,
            error: retryError.message,
            originalError: error.message
          };
        }
      }
    }
  }

  async handleFallback(error, intent, context = {}) {
    try {
      const fallbackIntent = this.getFallbackIntent(intent);
      
      if (!fallbackIntent) {
        return {
          success: false,
          action: 'no_fallback',
          error: 'No fallback strategy available',
          originalError: error.message
        };
      }
      
      console.log(`🔄 Using fallback strategy for ${intent.intent}`);
      
      return {
        success: true,
        action: 'fallback',
        fallbackIntent,
        originalError: error.message
      };
    } catch (fallbackError) {
      return {
        success: false,
        action: 'fallback_failed',
        error: fallbackError.message,
        originalError: error.message
      };
    }
  }

  async handleClarification(error, intent, context = {}) {
    try {
      const suggestions = this.getClarificationSuggestions(intent);
      
      console.log(`❓ Clarification needed for ${intent.intent}`);
      
      return {
        success: false,
        action: 'clarification_needed',
        suggestions,
        error: error.message,
        intent: intent.intent,
        originalText: intent.originalText
      };
    } catch (clarificationError) {
      return {
        success: false,
        action: 'clarification_failed',
        error: clarificationError.message,
        originalError: error.message
      };
    }
  }

  async handleGenericError(error, intent, context = {}) {
    console.log(`❌ Generic error handling for ${intent.intent}: ${error.message}`);
    
    return {
      success: false,
      action: 'generic_error',
      error: error.message,
      intent: intent.intent,
      originalText: intent.originalText,
      suggestions: [
        'Try rephrasing your command',
        'Check if the action is supported',
        'Verify the page state and try again'
      ]
    };
  }

  modifyIntentForRetry(intent, attempt) {
    const modifiedIntent = { ...intent };
    
    switch (intent.intent) {
      case 'click':
        // Try different selectors on retry
        if (attempt === 2) {
          modifiedIntent.parameters.selector = 'button, a, input[type="button"]';
        } else if (attempt === 3) {
          modifiedIntent.parameters.selector = '*[onclick], *[role="button"]';
        }
        break;
      
      case 'wait':
        // Increase timeout on retry
        const baseTimeout = parseInt(intent.parameters.timeout) || 5000;
        modifiedIntent.parameters.timeout = baseTimeout * attempt;
        break;
      
      case 'search':
        // Try different search selectors
        if (attempt === 2) {
          modifiedIntent.parameters.selector = 'input[type="search"], input[name="q"]';
        } else if (attempt === 3) {
          modifiedIntent.parameters.selector = 'input';
        }
        break;
    }
    
    return modifiedIntent;
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getErrorStatistics() {
    const stats = {
      totalErrors: this.errorHistory.length,
      errorsByType: {},
      errorsByIntent: {},
      recentErrors: this.errorHistory.slice(-10)
    };
    
    // Count errors by type
    this.errorHistory.forEach(error => {
      stats.errorsByType[error.errorType] = (stats.errorsByType[error.errorType] || 0) + 1;
      stats.errorsByIntent[error.intent] = (stats.errorsByIntent[error.intent] || 0) + 1;
    });
    
    return stats;
  }

  clearErrorHistory() {
    this.errorHistory = [];
  }

  // Method to validate intent parameters before execution
  validateIntent(intent) {
    const errors = [];
    
    // Check required parameters
    switch (intent.intent) {
      case 'search':
        if (!intent.parameters.query) {
          errors.push('Search query is required');
        }
        break;
      
      case 'click':
        if (!intent.parameters.selector) {
          errors.push('Click selector is required');
        }
        break;
      
      case 'navigate':
        if (!intent.parameters.url && !intent.parameters.action) {
          errors.push('URL or action is required for navigation');
        }
        break;
      
      case 'fill':
        if (!intent.parameters.selector || !intent.parameters.value) {
          errors.push('Selector and value are required for fill command');
        }
        break;
      
      case 'scroll':
        if (!intent.parameters.direction) {
          errors.push('Scroll direction is required');
        } else if (!['up', 'down', 'left', 'right'].includes(intent.parameters.direction.toLowerCase())) {
          errors.push('Invalid scroll direction. Use: up, down, left, or right');
        }
        break;
    }
    
    // Check confidence level
    if (intent.confidence < 0.3) {
      errors.push('Command confidence is very low. Please clarify your request.');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Method to suggest corrections for common mistakes
  suggestCorrections(intent) {
    const suggestions = [];
    
    // Common selector improvements
    if (intent.parameters.selector) {
      const selector = intent.parameters.selector.toLowerCase();
      
      if (selector.includes('button') && !selector.includes('[')) {
        suggestions.push('Try using a more specific selector like "button[type=\'submit\']" or "button:contains(\'text\')"');
      }
      
      if (selector.includes('input') && !selector.includes('[')) {
        suggestions.push('Try specifying input type like "input[type=\'text\']" or "input[name=\'fieldname\']"');
      }
    }
    
    // Common URL improvements
    if (intent.parameters.url && !intent.parameters.url.startsWith('http')) {
      suggestions.push('URL should start with http:// or https://');
    }
    
    return suggestions;
  }
}

export default ErrorHandler;
