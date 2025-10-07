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

    this.model = options.model || 'gpt-4o';
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
      },
      // Complex multi-step tasks
      book_flight: {
        description: 'Book a flight with multiple steps',
        parameters: {
          origin: { type: 'string', required: true, description: 'Departure city' },
          destination: { type: 'string', required: true, description: 'Arrival city' },
          departure_date: { type: 'string', required: false, description: 'Departure date' },
          return_date: { type: 'string', required: false, description: 'Return date' },
          passengers: { type: 'number', required: false, description: 'Number of passengers' },
          class: { type: 'string', required: false, description: 'Flight class (economy, business, first)' }
        }
      },
      shop_online: {
        description: 'Shop for products online',
        parameters: {
          product: { type: 'string', required: true, description: 'Product to search for' },
          max_price: { type: 'number', required: false, description: 'Maximum price' },
          brand: { type: 'string', required: false, description: 'Preferred brand' },
          quantity: { type: 'number', required: false, description: 'Quantity to purchase' }
        }
      },
      fill_form: {
        description: 'Fill out a form with multiple fields',
        parameters: {
          form_type: { type: 'string', required: true, description: 'Type of form (contact, job application, etc.)' },
          fields: { type: 'object', required: true, description: 'Form fields and values' }
        }
      },
      multi_step: {
        description: 'Execute a complex multi-step task',
        parameters: {
          task_description: { type: 'string', required: true, description: 'Description of the task' },
          steps: { type: 'array', required: false, description: 'List of steps to execute' }
        }
      },
      clarify_flight: {
        description: 'Ask for clarification on flight booking details',
        parameters: {
          message: { type: 'string', required: true, description: 'Clarification message to show user' }
        }
      },
      unknown: {
        description: 'Command not recognized or not supported',
        parameters: {
          message: { type: 'string', required: true, description: 'Error message explaining the issue' },
          suggestion: { type: 'string', required: false, description: 'Suggestion for similar supported command' }
        }
      },
      clarify: {
        description: 'Ask for clarification when command is ambiguous',
        parameters: {
          message: { type: 'string', required: true, description: 'Clarification message to show user' },
          options: { type: 'array', required: false, description: 'List of possible options for user to choose from' }
        }
      },
      // Advanced browser control commands
      type: {
        description: 'Type text into an input field or at current focus',
        parameters: {
          text: { type: 'string', required: true, description: 'Text to type' },
          selector: { type: 'string', required: false, description: 'Element to type into' }
        }
      },
      select: {
        description: 'Select options from a dropdown or multi-select',
        parameters: {
          selector: { type: 'string', required: true, description: 'Select element selector' },
          options: { type: 'array', required: true, description: 'Options to select' },
          multiple: { type: 'boolean', required: false, description: 'Whether multiple selection is allowed' }
        }
      },
      hover: {
        description: 'Hover over an element',
        parameters: {
          selector: { type: 'string', required: true, description: 'Element to hover over' }
        }
      },
      drag: {
        description: 'Drag an element to another location',
        parameters: {
          fromSelector: { type: 'string', required: true, description: 'Element to drag from' },
          toSelector: { type: 'string', required: true, description: 'Element to drag to' },
          steps: { type: 'number', required: false, description: 'Number of drag steps' }
        }
      },
      swipe: {
        description: 'Swipe in a direction',
        parameters: {
          direction: { type: 'string', required: true, description: 'Swipe direction (left, right, up, down)' },
          distance: { type: 'number', required: false, description: 'Swipe distance in pixels' }
        }
      },
      key: {
        description: 'Press a keyboard key',
        parameters: {
          key: { type: 'string', required: true, description: 'Key to press (Enter, Escape, Tab, etc.)' },
          selector: { type: 'string', required: false, description: 'Element to focus before pressing key' }
        }
      },
      refresh: {
        description: 'Refresh the current page',
        parameters: {}
      },
      back: {
        description: 'Go back to the previous page',
        parameters: {}
      },
      forward: {
        description: 'Go forward to the next page',
        parameters: {}
      },
      zoom: {
        description: 'Zoom in or out of the page',
        parameters: {
          level: { type: 'number', required: false, description: 'Zoom level (1.0 = normal, 1.5 = 150%, etc.)' }
        }
      },
      tab: {
        description: 'Manage browser tabs',
        parameters: {
          action: { type: 'string', required: false, description: 'Tab action (new, close, next, previous)' }
        }
      },
      download: {
        description: 'Download a file from a link or button',
        parameters: {
          selector: { type: 'string', required: true, description: 'Download link or button selector' },
          filename: { type: 'string', required: false, description: 'Custom filename for download' }
        }
      },
      upload: {
        description: 'Upload a file to an input field',
        parameters: {
          selector: { type: 'string', required: true, description: 'File input selector' },
          filePath: { type: 'string', required: true, description: 'Path to file to upload' }
        }
      },
      evaluate: {
        description: 'Execute JavaScript code on the page',
        parameters: {
          expression: { type: 'string', required: true, description: 'JavaScript expression to evaluate' },
          args: { type: 'array', required: false, description: 'Arguments to pass to the expression' }
        }
      },
      find: {
        description: 'Find text on the page',
        parameters: {
          text: { type: 'string', required: true, description: 'Text to find' },
          caseSensitive: { type: 'boolean', required: false, description: 'Whether search is case sensitive' },
          wholeWord: { type: 'boolean', required: false, description: 'Whether to match whole words only' }
        }
      },
      select_all: {
        description: 'Select all text on the page',
        parameters: {}
      },
      copy: {
        description: 'Copy selected text to clipboard',
        parameters: {}
      },
      paste: {
        description: 'Paste text from clipboard',
        parameters: {}
      },
      cut: {
        description: 'Cut selected text to clipboard',
        parameters: {}
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
          max_tokens: 300, // Reduced for faster response
          temperature: this.temperature
        }).catch(error => {
            // Handle OpenAI API errors gracefully
            if (error.status === 429) {
                console.warn('⚠️ OpenAI quota exceeded, falling back to basic intent parsing');
                return {
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                intent: 'search',
                                confidence: 0.7,
                                parameters: { query: transcript },
                                requiresConfirmation: true,
                                riskLevel: 'medium',
                                timestamp: new Date().toISOString()
                            })
                        }
                    }]
                };
            }
            throw error;
        });

      const parsedIntent = JSON.parse(response.choices[0].message.content);
      const enhancedIntent = this.validateAndEnhanceIntent(parsedIntent, transcript);
      
      // Add chain-of-thought reasoning for complex tasks (async, don't wait)
      if (this.isComplexTask(enhancedIntent)) {
        // Generate reasoning asynchronously (don't wait)
        this.generateReasoning(enhancedIntent, context).then(reasoning => {
          enhancedIntent.reasoning = reasoning;
        }).catch(err => console.log('Reasoning generation failed:', err.message));
        
        // Generate task steps asynchronously (don't wait)
        this.generateTaskSteps(enhancedIntent, context).then(steps => {
          enhancedIntent.steps = steps;
        }).catch(err => console.log('Step generation failed:', err.message));
      }
      
      return enhancedIntent;
    } catch (error) {
      console.error('Failed to parse intent:', error);
      throw error;
    }
  }

  isComplexTask(intent) {
    const complexIntents = ['multi_step', 'shopping', 'form_filling', 'data_extraction', 'workflow'];
    return complexIntents.includes(intent.intent) || 
           intent.parameters?.steps?.length > 1 ||
           intent.riskLevel === 'high';
  }

  async generateReasoning(intent, context) {
    try {
      const reasoningPrompt = `
Analyze this task and provide step-by-step reasoning:

Task: ${intent.originalText}
Intent: ${intent.intent}
Parameters: ${JSON.stringify(intent.parameters)}

Current Context:
- Current URL: ${context.currentUrl || 'Unknown'}
- Page Title: ${context.pageTitle || 'Unknown'}
- Previous Actions: ${context.recentActions?.length || 0} actions

Provide reasoning in this format:
{
  "analysis": "What the user wants to accomplish",
  "approach": "How to approach this task",
  "potential_challenges": ["challenge1", "challenge2"],
  "success_criteria": "How to know when task is complete",
  "fallback_plan": "What to do if primary approach fails"
}
`;

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: reasoningPrompt }],
        max_tokens: 300,
        temperature: 0.3
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('❌ Reasoning generation failed:', error);
      return {
        analysis: "Task analysis failed",
        approach: "Proceed with caution",
        potential_challenges: ["Unknown challenges"],
        success_criteria: "Complete the requested action",
        fallback_plan: "Ask user for clarification"
      };
    }
  }

  async generateTaskSteps(intent, context) {
    try {
      const stepsPrompt = `
Break down this task into specific, actionable steps:

Task: ${intent.originalText}
Intent: ${intent.intent}
Parameters: ${JSON.stringify(intent.parameters)}

Current Context:
- Current URL: ${context.currentUrl || 'Unknown'}
- Page Title: ${context.pageTitle || 'Unknown'}

Provide steps in this format:
{
  "steps": [
    {
      "step_number": 1,
      "action": "navigate|click|type|scroll|extract|wait",
      "description": "What this step does",
      "selector": "CSS selector or element description",
      "value": "Value to input (if applicable)",
      "expected_outcome": "What should happen",
      "requires_confirmation": false,
      "fallback_action": "What to do if this fails"
    }
  ],
  "total_steps": 1,
  "estimated_duration": "How long this might take"
}
`;

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: stepsPrompt }],
        max_tokens: 500,
        temperature: 0.2
      });

      const content = response.choices[0].message.content;
      
      // Try to extract JSON from the response
      let jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.log('❌ No JSON found in response, using fallback');
          // Return a simple fallback instead of throwing
          return {
            steps: [
              {
                step: 1,
                action: 'clarify',
                description: 'Ask user for clarification',
                parameters: { message: 'Please provide more details about your request.' }
              }
            ],
            total_steps: 1,
            estimated_duration: 'Unknown'
          };
        }
      
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (parseError) {
          console.log('❌ JSON parse error, using fallback:', parseError.message);
          // Return a simple fallback instead of throwing
          return {
            steps: [
              {
                step: 1,
                action: 'clarify',
                description: 'Ask user for clarification',
                parameters: { message: 'Please provide more details about your request.' }
              }
            ],
            total_steps: 1,
            estimated_duration: 'Unknown'
          };
        }
    } catch (error) {
      console.error('❌ Step generation failed:', error);
      return {
        steps: [{
          step_number: 1,
          action: intent.intent,
          description: `Execute ${intent.intent} command`,
          selector: intent.parameters?.selector || 'unknown',
          value: intent.parameters?.value || '',
          expected_outcome: 'Complete the requested action',
          requires_confirmation: intent.requiresConfirmation || false,
          fallback_action: 'Ask user for clarification'
        }],
        total_steps: 1,
        estimated_duration: 'Unknown'
      };
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
4. For complex tasks like "book a flight", "shop online", "fill form", use the specific complex intents (book_flight, shop_online, fill_form, multi_step)
5. If a command is not clear or ambiguous, use the "clarify" intent to ask for more information
6. If a command is not supported or not recognized, use the "unknown" intent with a helpful message and suggestion
7. Mark actions as requiring confirmation if they involve:
   - Navigation to external sites
   - Form submissions
   - Data deletion
   - Financial transactions
   - Sensitive operations
6. Set risk level based on potential impact:
   - Low: Reading, scrolling, taking screenshots
   - Medium: Clicking, filling forms, extracting data
   - High: Navigation, form submission, data modification

Examples:
- "Search for laptops" → {"intent": "search", "parameters": {"query": "laptops"}}
- "Click on the buy button" → {"intent": "click", "parameters": {"selector": "buy button"}}
- "Go back to the previous page" → {"intent": "navigate", "parameters": {"action": "back"}}
- "Fill in the email field with john@example.com" → {"intent": "fill", "parameters": {"selector": "email field", "value": "john@example.com"}}
- "Type hello world" → {"intent": "type", "parameters": {"text": "hello world"}}
- "Press Enter" → {"intent": "key", "parameters": {"key": "Enter"}}
- "Hover over the menu" → {"intent": "hover", "parameters": {"selector": "menu"}}
- "Scroll down" → {"intent": "scroll", "parameters": {"direction": "down"}}
- "Take a screenshot" → {"intent": "screenshot", "parameters": {}}
- "Copy this text" → {"intent": "copy", "parameters": {}}
- "Select all" → {"intent": "select_all", "parameters": {}}
- "Zoom in" → {"intent": "zoom", "parameters": {"level": 1.5}}
- "Open new tab" → {"intent": "tab", "parameters": {"action": "new"}}
- "Download this file" → {"intent": "download", "parameters": {"selector": "download link"}}
- "Upload the document" → {"intent": "upload", "parameters": {"selector": "file input", "filePath": "/path/to/file"}}

- "Book a flight from New York to Delhi" → {"intent": "book_flight", "parameters": {"origin": "New York", "destination": "Delhi"}, "requiresConfirmation": true, "riskLevel": "high"}
- "Book a flight from San Francisco to Tokyo on December 10" → {"intent": "book_flight", "parameters": {"origin": "San Francisco", "destination": "Tokyo", "departure_date": "December 10"}, "requiresConfirmation": true, "riskLevel": "high"}
- "Book a flight" → {"intent": "clarify_flight", "parameters": {"message": "I need more information to book a flight. Please specify the origin and destination cities."}, "requiresConfirmation": false, "riskLevel": "low"}
- "Choose departure date from December 10 and return date December 16" → {"intent": "book_flight", "parameters": {"departure_date": "December 10", "return_date": "December 16"}, "requiresConfirmation": false, "riskLevel": "medium"}
- "Shop for laptops under 1000 dollars" → {"intent": "shop_online", "parameters": {"product": "laptops", "max_price": 1000}, "requiresConfirmation": true, "riskLevel": "medium"}
- "Fill out the contact form" → {"intent": "fill_form", "parameters": {"form_type": "contact"}, "requiresConfirmation": true, "riskLevel": "medium"}
- "Find and buy a laptop on Amazon" → {"intent": "multi_step", "parameters": {"task_description": "Find and buy a laptop on Amazon"}, "requiresConfirmation": true, "riskLevel": "high"}
- "Choose the best one" → {"intent": "select", "parameters": {"selector": "best option", "options": ["first", "second", "third"]}, "requiresConfirmation": false, "riskLevel": "low"}
- "Now read the Reddit post" → {"intent": "extract", "parameters": {"selector": "Reddit post content", "dataType": "text"}, "requiresConfirmation": false, "riskLevel": "low"}
- "Extract the data from Reddit" → {"intent": "extract", "parameters": {"source": "Reddit", "dataType": "all"}, "requiresConfirmation": false, "riskLevel": "low"}
- "Play some music" → {"intent": "unknown", "parameters": {"message": "I can't play music. I'm a browser automation agent.", "suggestion": "Try commands like 'search for music' or 'navigate to a music website'"}, "requiresConfirmation": false, "riskLevel": "low"}
- "Do something" → {"intent": "clarify", "parameters": {"message": "What would you like me to do?", "options": ["search", "navigate", "click", "extract data"]}, "requiresConfirmation": false, "riskLevel": "low"}`;
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
        temperature: this.temperature
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
