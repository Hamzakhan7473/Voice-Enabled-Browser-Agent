/**
 * LLM Client - OpenAI integration with tool calling
 * Clean, typed interface for reasoning loop
 */

import OpenAI from 'openai';
import type { AgentGoal, WorldState, ToolCall, SelectorInfo } from './types.js';
import { AGENT_TOOLS, SYSTEM_PROMPT } from './tools.js';

export class LLMClient {
  private openai: OpenAI;
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor(config: {
    apiKey?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  } = {}) {
    this.openai = new OpenAI({ apiKey: config.apiKey || process.env.OPENAI_API_KEY });
    this.model = config.model || 'gpt-4-turbo-preview';
    this.temperature = config.temperature || 0.1;
    this.maxTokens = config.maxTokens || 4000;
  }

  /**
   * Ask LLM for next action based on current world state
   */
  async getNextAction(
    goal: AgentGoal,
    world: WorldState,
    previousSteps: Array<{ action: ToolCall; result: any }> = []
  ): Promise<{ toolCall: ToolCall; reasoning?: string }> {
    const messages = this.buildMessages(goal, world, previousSteps);

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages,
      tools: AGENT_TOOLS,
      tool_choice: 'required',
      temperature: this.temperature,
      max_tokens: this.maxTokens
    });

    const choice = response.choices[0];
    
    if (!choice.message.tool_calls || choice.message.tool_calls.length === 0) {
      throw new Error('LLM did not return a tool call');
    }

    const toolCall = choice.message.tool_calls[0];
    const parsedCall = this.parseToolCall(toolCall);

    return {
      toolCall: parsedCall,
      reasoning: choice.message.content || undefined
    };
  }

  /**
   * Build context-rich message history for LLM
   */
  private buildMessages(
    goal: AgentGoal,
    world: WorldState,
    previousSteps: Array<{ action: ToolCall; result: any }>
  ): Array<OpenAI.Chat.ChatCompletionMessageParam> {
    const messages: Array<OpenAI.Chat.ChatCompletionMessageParam> = [
      { role: 'system', content: SYSTEM_PROMPT }
    ];

    // Initial user goal
    let goalMessage = `**Goal:** ${goal.userPrompt}\n\n`;
    
    if (goal.constraints && goal.constraints.length > 0) {
      goalMessage += `**Constraints:**\n${goal.constraints.map(c => `- ${c}`).join('\n')}\n\n`;
    }
    
    if (goal.successCriteria && goal.successCriteria.length > 0) {
      goalMessage += `**Success criteria:**\n${goal.successCriteria.map(s => `- ${s}`).join('\n')}\n\n`;
    }

    goalMessage += `**Maximum steps:** ${goal.maxSteps || 30}\n`;

    messages.push({ role: 'user', content: goalMessage });

    // Add previous steps (keep last 5 for context)
    const recentSteps = previousSteps.slice(-5);
    for (const step of recentSteps) {
      messages.push({
        role: 'assistant',
        content: `Action: ${step.action.name}(${JSON.stringify(step.action.args)})`
      });
      
      messages.push({
        role: 'user',
        content: `Result: ${step.result.success ? 'Success' : 'Failed'}\n${JSON.stringify(step.result.data || step.result.error, null, 2)}`
      });
    }

    // Current world state
    const stateMessage = this.formatWorldState(world);
    messages.push({ role: 'user', content: stateMessage });

    return messages;
  }

  /**
   * Format world state in a token-efficient way
   */
  private formatWorldState(world: WorldState): string {
    let state = `**Current State (Step ${world.step}):**\n\n`;
    state += world.domSummary;
    state += `\n\n**Available Actions:**\n`;
    
    if (world.visibleSelectors.length > 0) {
      const grouped = this.groupSelectors(world.visibleSelectors);
      
      if (grouped.buttons.length > 0) {
        state += `\nButtons:\n${grouped.buttons.map(s => `  - ${s.text} → ${s.selector}`).join('\n')}`;
      }
      
      if (grouped.links.length > 0) {
        state += `\n\nLinks (first 10):\n${grouped.links.slice(0, 10).map(s => `  - ${s.text} → ${s.selector}`).join('\n')}`;
      }
      
      if (grouped.inputs.length > 0) {
        state += `\n\nInput Fields:\n${grouped.inputs.map(s => `  - ${s.text} → ${s.selector}`).join('\n')}`;
      }
      
      if (grouped.forms.length > 0) {
        state += `\n\nForms:\n${grouped.forms.map(s => `  - ${s.selector}`).join('\n')}`;
      }
    }

    if (world.lastError) {
      state += `\n\n**Last Error:** ${world.lastError}`;
    }

    return state;
  }

  /**
   * Group selectors by type for cleaner presentation
   */
  private groupSelectors(selectors: SelectorInfo[]) {
    return {
      buttons: selectors.filter(s => s.type === 'button'),
      links: selectors.filter(s => s.type === 'link'),
      inputs: selectors.filter(s => s.type === 'input'),
      forms: selectors.filter(s => s.type === 'form'),
      other: selectors.filter(s => s.type === 'other')
    };
  }

  /**
   * Parse OpenAI tool call into our ToolCall type
   */
  private parseToolCall(toolCall: OpenAI.Chat.ChatCompletionMessageToolCall): ToolCall {
    const name = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments);

    // Type-safe construction
    return { name, args } as ToolCall;
  }
}

