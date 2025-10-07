import OpenAI from "openai";
import { bbCapture, bbClick, bbGoto, bbScroll, bbType, bbWaitFor } from "../browser/bb-exec.js";

export class ComputerUseAgentV2 {
  constructor(page) {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.page = page;
    this.maxTurns = 10;
  }

  async runAgent(goal) {
    console.log(`🎯 Starting agent with goal: ${goal}`);

    try {
      // Start at Google for most tasks
      await bbGoto(this.page, "https://www.google.com");

      let turnCount = 0;
      while (turnCount < this.maxTurns) {
        turnCount++;
        console.log(`\n🔄 Turn ${turnCount}/${this.maxTurns}`);

        // 1) Perceive
        const perception = await bbCapture(this.page);
        console.log(`📊 Page captured: ${perception.title}`);

        // 2) Decide
        const actions = await this.decide(goal, perception);
        
        if (actions.length === 0) {
          console.log('✅ No more actions needed');
          break;
        }

        // Check for done action
        const doneAction = actions.find(a => a.name === 'done');
        if (doneAction) {
          return doneAction.summary || 'Task completed successfully!';
        }

        // 3) Act
        for (const action of actions) {
          await this.act(action);
        }
      }

      return `Task attempted (${turnCount} turns completed)`;

    } catch (error) {
      console.error('❌ Agent error:', error);
      throw error;
    }
  }

  async decide(goal, perception) {
    console.log('🧠 Deciding next actions...');

    const response = await this.client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a computer-using agent. Use selectors when possible, ask before destructive/financial actions. 

Current page: ${perception.title} (${perception.url})

Available elements:
${perception.domSnippet}

Reply ONLY with tool calls. Use computer_use tool to output actions as structured JSON.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Goal: ${goal}`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${perception.screenshotB64}`,
                detail: "low"
              }
            }
          ]
        }
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "computer_use",
            description: "Perform browser actions",
            parameters: {
              type: "object",
              properties: {
                actions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: {
                        type: "string",
                        enum: ["goto", "click", "type", "scroll", "wait_for", "done"]
                      },
                      url: { type: "string" },
                      selector: { type: "string" },
                      x: { type: "number" },
                      y: { type: "number" },
                      text: { type: "string" },
                      dx: { type: "number" },
                      dy: { type: "number" },
                      scroll_to: { type: "string", enum: ["top", "bottom"] },
                      timeout_ms: { type: "number" },
                      summary: { type: "string" }
                    }
                  }
                }
              },
              required: ["actions"]
            }
          }
        }
      ],
      tool_choice: "required",
      max_tokens: 1000
    });

    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.log('⚠️ No tool call in response');
      return [];
    }

    const args = JSON.parse(toolCall.function.arguments);
    const actions = args.actions || [];

    console.log(`🎯 Decided on ${actions.length} actions`);
    return actions;
  }

  async act(action) {
    console.log(`⚡ Acting: ${action.name}`);

    switch (action.name) {
      case "goto":
        await bbGoto(this.page, action.url);
        break;

      case "click":
        await bbClick(this.page, { 
          selector: action.selector, 
          x: action.x, 
          y: action.y 
        });
        break;

      case "type":
        await bbType(this.page, action.selector, action.text);
        break;

      case "scroll":
        await bbScroll(this.page, {
          dx: action.dx,
          dy: action.dy,
          to: action.scroll_to
        });
        break;

      case "wait_for":
        await bbWaitFor(this.page, action.selector, action.timeout_ms || 8000);
        break;

      case "done":
        console.log(`✅ Done: ${action.summary}`);
        break;

      default:
        console.warn(`⚠️ Unknown action: ${action.name}`);
    }
  }
}