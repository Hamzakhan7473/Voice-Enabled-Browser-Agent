import OpenAI from 'openai';

class IntentParser {
  constructor(options = {}) {
    this.apiKey = process.env.OPENAI_API_KEY;
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.client = new OpenAI({
      apiKey: this.apiKey
    });

    this.model = options.model || 'gpt-4';
    this.maxTokens = options.maxTokens || 500;
    this.temperature = options.temperature || 0.1;

    // Define supported intents and their schemas
    this.intentSchemas = {
      search: {
        description: 'Search for information on a webpage',
        parameters: {
          query: { type: 'string', required: true, description: 'Search query' },
          selector: { type: 'string', required: false, description: 'Specific element to search within' }
        }
      },
      click: {
        description: 'Click on an element',
        parameters: {
          selector: { type: 'string', required: true, description: 'CSS selector or text to click' },
          index: { type: 'number', required: false, description: 'Index if multiple elements match' }
        }
      },
      navigate: {
        description: 'Navigate to a URL or page',
        parameters: {
          url: { type: 'string', required: false, description: 'URL to navigate to' },
          action: { type: 'string', required: false, description: 'Navigation action like back, forward, refresh' }
        }
      },
      fill: {
        description: 'Fill out a form field',
        parameters: {
          selector: { type: 'string', required: true, description: 'Form field selector' },
          value: { type: 'string', required: true, description: 'Value to fill' },
          fieldType: { type: 'string', required: false, description: 'Type of field (input, textarea, select)' }
        }
      },
      scroll: {
        description: 'Scroll the page',
        parameters: {
          direction: { type: 'string', required: true, description: 'Direction to scroll (up, down, left, right)' },
          amount: { type: 'number', required: false, description: 'Amount to scroll in pixels' }
        }
      },
      extract: {
        description: 'Extract data from the page',
        parameters: {
          selector: { type: 'string', required: false, description: 'CSS selector for elements to extract' },
          dataType: { type: 'string', required: false, description: 'Type of data to extract (text, links, images, table)' },
          format: { type: 'string', required: false, description: 'Output format (json, csv, text)' }
        }
      },
      screenshot: {
        description: 'Take a screenshot',
        parameters: {
          selector: { type: 'string', required: false, description: 'Specific element to screenshot' },
          fullPage: { type: 'boolean', required: false, description: 'Whether to capture full page' }
        }
      },
      wait: {
        description: 'Wait for an element or condition',
        parameters: {
          selector: { type: 'string', required: false, description: 'Element to wait for' },
          timeout: { type: 'number', required: false, description: 'Timeout in milliseconds' },
          condition: { type: 'string', required: false, description: 'Condition to wait for (visible, hidden, clickable)' }
        }
      },
      sort: {
        description: 'Sort data or elements',
        parameters: {
          selector: { type: 'string', required: true, description: 'Element to sort' },
          criteria: { type: 'string', required: true, description: 'Sort criteria (price, name, date, etc.)' },
          order: { type: 'string', required: false, description: 'Sort order (ascending, descending)' }
        }
      },
      filter: {
        description: 'Filter data or elements',
        parameters: {
          selector: { type: 'string', required: true, description: 'Element to filter' },
          criteria: { type: 'string', required: true, description: 'Filter criteria' },
          value: { type: 'string', required: true, description: 'Filter value' }
        }
      },
      confirm: {
        description: 'Confirm an action',
        parameters: {
          action: { type: 'string', required: true, description: 'Action to confirm' },
          message: { type: 'string', required: false, description: 'Confirmation message' }
        }
      },
      cancel: {
        description: 'Cancel an action',
        parameters: {
          action: { type: 'string', required: false, description: 'Action to cancel' }
        }
      }
    };
  }

  async parseIntent(transcript, context = {}) {
    try {
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(transcript, context);

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        response_format: { type: 'json_object' }
      });

      const parsedIntent = JSON.parse(response.choices[0].message.content);
      return this.validateAndEnhanceIntent(parsedIntent, transcript);
    } catch (error) {
      console.error('Failed to parse intent:', error);
      throw error;
    }
  }

  buildSystemPrompt() {
    const intentDescriptions = Object.entries(this.intentSchemas)
      .map(([name, schema]) => `${name}: ${schema.description}`)
      .join('\n');

    return `You are an intent parser for a voice-enabled browser automation agent. Your task is to convert natural language commands into structured JSON intents.

Supported intents:
${intentDescriptions}

You must respond with a JSON object containing:
- intent: The primary intent (one of the supported intents above)
- confidence: A number between 0 and 1 indicating confidence in the parsing
- parameters: An object containing the required and optional parameters for the intent
- originalText: The original transcript text
- requiresConfirmation: Boolean indicating if this action requires user confirmation
- riskLevel: Risk level (low, medium, high) for the action

Guidelines:
1. Extract the most specific intent from the command
2. Fill in parameters based on the command context
3. Set high confidence for clear commands, lower for ambiguous ones
4. Mark actions as requiring confirmation if they involve:
   - Navigation to external sites
   - Form submissions
   - Data deletion
   - Financial transactions
   - Sensitive operations
5. Set risk level based on potential impact:
   - Low: Reading, scrolling, taking screenshots
   - Medium: Clicking, filling forms, extracting data
   - High: Navigation, form submission, data modification

Examples:
- "Search for laptops" → {"intent": "search", "parameters": {"query": "laptops"}}
- "Click on the buy button" → {"intent": "click", "parameters": {"selector": "buy button"}}
- "Go back to the previous page" → {"intent": "navigate", "parameters": {"action": "back"}}
- "Fill in the email field with john@example.com" → {"intent": "fill", "parameters": {"selector": "email field", "value": "john@example.com"}}`;
  }

  buildUserPrompt(transcript, context) {
    let prompt = `Parse this voice command: "${transcript}"`;

    if (context.currentUrl) {
      prompt += `\n\nCurrent page URL: ${context.currentUrl}`;
    }

    if (context.previousIntents && context.previousIntents.length > 0) {
      prompt += `\n\nPrevious commands in this session:`;
      context.previousIntents.forEach((intent, index) => {
        prompt += `\n${index + 1}. ${intent.originalText} → ${intent.intent}`;
      });
    }

    if (context.pageElements && context.pageElements.length > 0) {
      prompt += `\n\nAvailable page elements: ${context.pageElements.slice(0, 10).join(', ')}`;
    }

    return prompt;
  }

  validateAndEnhanceIntent(parsedIntent, transcript) {
    const { intent, parameters = {}, confidence = 0.5 } = parsedIntent;

    // Validate intent exists
    if (!this.intentSchemas[intent]) {
      console.warn(`Unknown intent: ${intent}`);
      return {
        intent: 'unknown',
        confidence: 0,
        parameters: {},
        originalText: transcript,
        requiresConfirmation: true,
        riskLevel: 'high',
        error: `Unknown intent: ${intent}`
      };
    }

    // Validate required parameters
    const schema = this.intentSchemas[intent];
    const missingParams = [];
    
    Object.entries(schema.parameters).forEach(([paramName, paramSchema]) => {
      if (paramSchema.required && !parameters[paramName]) {
        missingParams.push(paramName);
      }
    });

    if (missingParams.length > 0) {
      console.warn(`Missing required parameters for ${intent}: ${missingParams.join(', ')}`);
    }

    // Enhance with additional metadata
    const enhancedIntent = {
      intent,
      confidence: Math.max(0, Math.min(1, confidence)),
      parameters,
      originalText: transcript,
      requiresConfirmation: this.determineConfirmationRequirement(intent, parameters),
      riskLevel: this.determineRiskLevel(intent, parameters),
      timestamp: new Date().toISOString(),
      missingParameters: missingParams
    };

    return enhancedIntent;
  }

  determineConfirmationRequirement(intent, parameters) {
    const highRiskIntents = ['navigate', 'fill', 'confirm', 'cancel'];
    const highRiskActions = ['submit', 'checkout', 'purchase', 'delete', 'remove'];
    
    if (highRiskIntents.includes(intent)) {
      return true;
    }

    // Check for high-risk actions in parameters
    const paramValues = Object.values(parameters).join(' ').toLowerCase();
    if (highRiskActions.some(action => paramValues.includes(action))) {
      return true;
    }

    return false;
  }

  determineRiskLevel(intent, parameters) {
    const lowRiskIntents = ['scroll', 'screenshot', 'extract', 'wait'];
    const mediumRiskIntents = ['click', 'fill', 'search', 'sort', 'filter'];
    const highRiskIntents = ['navigate', 'confirm', 'cancel'];

    if (lowRiskIntents.includes(intent)) {
      return 'low';
    }

    if (mediumRiskIntents.includes(intent)) {
      return 'medium';
    }

    if (highRiskIntents.includes(intent)) {
      return 'high';
    }

    return 'medium';
  }

  // Method to handle follow-up commands with context
  async parseFollowUpCommand(transcript, previousIntent, context = {}) {
    try {
      const systemPrompt = `You are parsing a follow-up command that references a previous action. Consider the context of the previous command and current page state.

Previous command: ${previousIntent.originalText} → ${previousIntent.intent}
Current page: ${context.currentUrl || 'unknown'}

Parse this follow-up command: "${transcript}"

Respond with the same JSON format as before, but consider how this command relates to the previous one.`;

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: transcript }
        ],
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        response_format: { type: 'json_object' }
      });

      const parsedIntent = JSON.parse(response.choices[0].message.content);
      return this.validateAndEnhanceIntent(parsedIntent, transcript);
    } catch (error) {
      console.error('Failed to parse follow-up command:', error);
      throw error;
    }
  }

  // Method to get intent suggestions based on current page context
  getIntentSuggestions(pageContext) {
    const suggestions = [];

    if (pageContext.hasSearchBox) {
      suggestions.push('search');
    }

    if (pageContext.hasForms) {
      suggestions.push('fill');
    }

    if (pageContext.hasLinks) {
      suggestions.push('click');
    }

    if (pageContext.hasTables) {
      suggestions.push('extract', 'sort', 'filter');
    }

    suggestions.push('screenshot', 'scroll', 'wait');

    return suggestions;
  }
}

export default IntentParser;
