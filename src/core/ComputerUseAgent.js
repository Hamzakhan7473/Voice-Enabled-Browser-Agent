import OpenAI from 'openai';
import { EventEmitter } from 'events';

/**
 * OpenAI Computer-Using Agent that mimics Operator's architecture
 * Takes screenshots as input and outputs granular actions
 */
class ComputerUseAgent extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        
        this.browserController = options.browserController;
        this.model = options.model || 'gpt-4o';
        this.maxActions = options.maxActions || 3;
        this.currentStep = 0;
        
        // State management like Operator
        this.state = {
            goal: null,
            ui: { image_base64: null, dom_excerpt: null },
            history: [],
            lastActions: []
        };
    }

    /**
     * Main action loop - mimics OpenAI Operator exactly
     */
    async executeGoal(goal) {
        try {
            console.log('🎯 Starting OpenAI Operator-style execution for:', goal);
            console.log('🔍 BrowserController available?:', !!this.browserController);
            console.log('🔍 Page available?:', !!this.browserController?.page);
            
            this.state.goal = goal;
            this.currentStep = 0;
            
            // Capture initial screen state
            await this.captureCurrentState();
            
            // Start the action loop
            while (this.currentStep < this.maxActions) {
                const actions = await this.decideNextActions();
                
                if (!actions || actions.length === 0) {
                    console.log('✅ No more actions needed - task complete');
                    break;
                }
                
                // Execute each action
                for (const action of actions) {
                    await this.executeAction(action);
                    
                    // Emit live screenshot after each action
                    this.emit('action-observed', {
                        action: action,
                        screenshot: await this.browserController.takeScreenshot(),
                        step: this.currentStep
                    });
                }
                
                this.currentStep++;
                
                // Capture updated state for next iteration
                await this.captureCurrentState();
                
                // Minimized delay for faster execution
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            return {
                success: true,
                goal: goal,
                stepsCompleted: this.currentStep,
                message: 'Task completed successfully'
            };
            
        } catch (error) {
            console.error('❌ Operator-style execution failed:', error);
            throw error;
        }
    }

    /**
     * Capture current browser state (screenshot + DOM)
     */
    async captureCurrentState() {
        try {
            const screenshot = await this.browserController.page.screenshot({
                encoding: 'base64',
                type: 'png'
            });
            
            // Get simplified DOM excerpt
            const domExcerpt = await this.browserController.page.evaluate(() => {
                const elements = document.querySelectorAll('input, button, a, form, [role="button"], [role="link"]');
                return Array.from(elements).slice(0, 20).map(el => ({
                    tag: el.tagName,
                    text: el.textContent?.slice(0, 100),
                    placeholder: el.placeholder,
                    href: el.href,
                    type: el.type,
                    className: el.className,
                    id: el.id,
                    role: el.getAttribute('role')
                }));
            });
            
            this.state.ui = {
                image_base64: screenshot,
                dom_excerpt: domExcerpt,
                url: this.browserController.page.url(),
                title: this.browserController.page.title()
            };
            
            console.log(`📸 Captured state: ${this.state.ui.title} (${domExcerpt.length} interactive elements)`);
            
        } catch (error) {
            console.error('❌ Failed to capture state:', error);
            throw error;
        }
    }

    /**
     * Use OpenAI's official computer-use tool as per official docs
     */
    async decideNextActions() {
        try {
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    {
                        role: "system",
                        content: `You are a Computer-Using Agent powered by OpenAI. You can see and control computer screens through the browser.

TASK: ${this.state.goal}

INSTRUCTIONS:
- Look at the provided screenshot and DOM information
- Use the computer-use tool to interact with the interface
- Work step by step toward completing the goal
- Be precise and methodical with your actions
- If you need more information, ask clarifying questions

Current context:
- URL: ${this.state.ui.url}
- Page Title: ${this.state.ui.title}
- Interactive elements available: ${this.state.ui.dom_excerpt?.length || 0}
- Steps completed: ${this.currentStep}/${this.maxActions}`
                    },
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: `Please analyze this screen and take the next appropriate action toward completing: "${this.state.goal}"`
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:image/png;base64,${this.state.ui.image_base64}`,
                                    detail: "high"
                                }
                            }
                        ]
                    }
                ],
                tools: [
                    {
                        type: "function",
                        function: {
                            name: "computer-use",
                            description: "Interact with the computer screen using mouse clicks, keyboard input, and scrolling",
                            parameters: {
                                type: "object",
                                properties: {
                                    action: {
                                        type: "string",
                                        enum: ["click", "type", "scroll", "navigate", "wait", "select", "focus", "press_key"],
                                        description: "The type of action to perform"
                                    },
                                    selector: {
                                        type: "string",
                                        description: "CSS selector for the target element (preferred when possible)"
                                    },
                                    x: {
                                        type: "number",
                                        description: "X coordinate for click action (fallback when selector not available)"
                                    },
                                    y: {
                                        type: "number", 
                                        description: "Y coordinate for click action (fallback when selector not available)"
                                    },
                                    text: {
                                        type: "string",
                                        description: "Text to type (for type action)"
                                    },
                                    direction: {
                                        type: "string",
                                        enum: ["up", "down"],
                                        description: "Scroll direction (for scroll action)"
                                    },
                                    amount: {
                                        type: "number",
                                        description: "Scroll amount in pixels or seconds for wait"
                                    },
                                    url: {
                                        type: "string",
                                        description: "URL to navigate to (for navigate action)"
                                    },
                                    seconds: {
                                        type: "number",
                                        description: "Seconds to wait (for wait action)"
                                    },
                                    option: {
                                        type: "string",
                                        description: "Option value to select (for select action)"
                                    },
                                    key: {
                                        type: "string",
                                        description: "Key to press (for press_key action)"
                                    }
                                },
                                required: ["action"]
                            }
                        }
                    }
                ],
                tool_choice: "auto",
                max_tokens: 1000,
                temperature: 0.1
            });

            const message = response.choices[0].message;
            const content = message.content;
            const tool_calls = message.tool_calls;
            
            console.log('🤖 Model response:', content);
            console.log('🔧 Tool calls:', tool_calls ? tool_calls.length : 0);
            
            // Parse tool calls for computer-use actions
            if (tool_calls && tool_calls.length > 0) {
                const actions = [];
                
                for (const toolCall of tool_calls) {
                    if (toolCall.function.name === 'computer-use') {
                        try {
                            const actionData = JSON.parse(toolCall.function.arguments);
                            actions.push(actionData);
                        } catch (parseError) {
                            console.warn('⚠️ Failed to parse tool arguments:', parseError);
                            continue;
                        }
                    }
                }
                
                if (actions.length > 0) {
                    console.log(`⚡ Decided actions via tool calls:`, actions);
                    return actions;
                }
            }
            
            // Check if task is complete from content
            if (content && (content.includes('TASK_COMPLETE') || 
                           content.includes('completed') || 
                           content.includes('successfully finished'))) {
                return [];
            }
            
            // If no tool calls and no completion, try to continue
            return [];
            
        } catch (error) {
            console.error('❌ Failed to decide actions:', error);
            throw error;
        }
    }

    /**
     * Execute a single action using OpenAI's official computer-use patterns
     */
    async executeAction(actionData) {
        try {
            const { action, selector, x, y, text, direction, amount, url, seconds, option, key } = actionData;
            
            console.log(`🎯 Executing OpenAI computer-use action: ${action}`, actionData);
            
            switch (action) {
                case 'click':
                    if (selector) {
                        // Use semantic selector (preferred)
                        await this.browserController.page.click(selector, { timeout: 5000 });
                        console.log(`✅ Clicked selector: ${selector}`);
                    } else if (x !== undefined && y !== undefined) {
                        // Fallback to coordinates
                        await this.browserController.page.click({ x, y });
                        console.log(`✅ Clicked coordinates: (${x}, ${y})`);
                    } else {
                        throw new Error('Click action requires either selector or x,y coordinates');
                    }
                    break;
                    
                case 'type':
                    if (!selector) throw new Error('Type action requires selector');
                    if (!text) throw new Error('Type action requires text');
                    
                    // Focus first, then type
                    await this.browserController.page.focus(selector);
                    await this.browserController.page.fill(selector, '');
                    await this.browserController.page.type(selector, text, { delay: 100 });
                    console.log(`✅ Typed "${text}" into ${selector}`);
                    break;
                    
                case 'scroll':
                    const scrollAmount = amount || 500;
                    const scrollDirection = direction === 'up' ? -scrollAmount : scrollAmount;
                    
                    await this.browserController.page.evaluate(amount => {
                        window.scrollBy(0, amount);
                    }, scrollDirection);
                    console.log(`✅ Scrolled ${direction} by ${scrollAmount}px`);
                    break;
                    
                case 'navigate':
                    if (!url) throw new Error('Navigate action requires url');
                    await this.browserController.navigateTo(url);
                    console.log(`✅ Navigated to: ${url}`);
                    break;
                    
                case 'wait':
                    const waitTime = seconds || 1;
                    await this.browserController.page.waitForTimeout(waitTime * 1000);
                    console.log(`✅ Waited ${waitTime} seconds`);
                    break;
                    
                case 'select':
                    if (!selector) throw new Error('Select action requires selector');
                    if (!option) throw new Error('Select action requires option');
                    await this.browserController.page.selectOption(selector, option);
                    console.log(`✅ Selected "${option}" in ${selector}`);
                    break;
                    
                case 'focus':
                    if (!selector) throw new Error('Focus action requires selector');
                    await this.browserController.page.focus(selector);
                    console.log(`✅ Focused ${selector}`);
                    break;
                    
                case 'press_key':
                    const keyToPress = key || 'Enter';
                    await this.browserController.page.keyboard.press(keyToPress);
                    console.log(`✅ Pressed key: ${keyToPress}`);
                    break;
                    
                default:
                    throw new Error(`Unknown computer-use action: ${action}`);
            }
            
            // Add to action history for tracing
            this.state.history.push({
                step: this.currentStep,
                action: actionData,
                timestamp: Date.now(),
                success: true
            });
            
            console.log(`✅ Successfully completed computer-use action: ${action}`);
            
            // Emit live screenshot after each action
            try {
                const screenshot = await this.browserController.page.screenshot({ 
                    encoding: 'base64',
                    type: 'png'
                });
                
                this.emit('action-observed', {
                    action: actionData,
                    screenshot: screenshot,
                    step: this.currentStep,
                    message: `Completed ${action}`
                });
            } catch (screenshotError) {
                console.warn('⚠️ Failed to capture screenshot after action:', screenshotError);
            }
            
        } catch (error) {
            // Add failed action to history
            this.state.history.push({
                step: this.currentStep,
                action: actionData,
                timestamp: Date.now(),
                success: false,
                error: error.message
            });
            
            console.error(`❌ Computer-use action failed: ${action}`, error);
            throw error;
        }
    }

    /**
     * Get current state for debugging
     */
    getState() {
        return {
            goal: this.state.goal,
            step: this.currentStep,
            url: this.state.ui.url,
            title: this.state.ui.title,
            actionHistory: this.state.history,
            interactiveElements: this.state.ui.dom_excerpt?.length || 0
        };
    }
}

export default ComputerUseAgent;
