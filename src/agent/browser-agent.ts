/**
 * Browser Agent - Main reasoning loop
 * Plan → Act → Observe → Critique → Repeat
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import type { AgentGoal, AgentConfig, WorldState, AgentStep, ToolCall } from './types.js';
import { LLMClient } from './llm-client.js';
import { ToolExecutor } from './tool-executor.js';
import { SafetyGuard } from './safety.js';
import { ObservabilityLogger } from './observability.js';
import { summarizeDOM, extractStableSelectors } from './dom-summarizer.js';

export class BrowserAgent {
  private llm: LLMClient;
  private safety: SafetyGuard;
  private logger: ObservabilityLogger;
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
    this.llm = new LLMClient(config.llm);
    this.safety = new SafetyGuard(config.safety);
    this.logger = new ObservabilityLogger({ logsDir: config.observability.logsDir });
  }

  /**
   * Main entry point: run agent to accomplish goal
   */
  async run(goal: AgentGoal, startUrl?: string): Promise<{
    success: boolean;
    result?: string;
    error?: string;
    steps: number;
  }> {
    const runId = uuidv4();
    await this.logger.startRun(runId, goal);

    let browser: Browser | undefined;
    let context: BrowserContext | undefined;
    let page: Page | undefined;

    try {
      // Launch browser
      browser = await chromium.launch({ 
        headless: this.config.browser.headless !== false 
      });

      context = await browser.newContext({
        userAgent: this.config.browser.userAgent || this.config.safety.userAgent || 'Mozilla/5.0 (Agent/1.0)',
        viewport: this.config.browser.viewport || { width: 1280, height: 720 }
      });

      page = await context.newPage();

      // Initialize executor
      const executor = new ToolExecutor(page, {
        screenshotsDir: this.config.observability.screenshotsDir
      });

      // Reset safety counters
      this.safety.reset();

      // Navigate to start URL if provided
      if (startUrl) {
        await page.goto(startUrl, { waitUntil: 'domcontentloaded' });
      }

      // Reasoning loop
      const maxSteps = goal.maxSteps || 30;
      const stepHistory: Array<{ action: ToolCall; result: any }> = [];
      
      for (let step = 0; step < maxSteps; step++) {
        const stepStart = Date.now();

        // Observe current state
        const worldState = await this.observeWorld(page, step);

        // Ask LLM for next action
        const { toolCall, reasoning } = await this.llm.getNextAction(goal, worldState, stepHistory);

        // Safety check
        const safetyCheck = await this.safety.checkAction(worldState.url, toolCall);
        
        if (!safetyCheck.allowed) {
          const error = `Safety check failed: ${safetyCheck.reason}`;
          await this.logger.completeRun('failed', undefined, error);
          return { success: false, error, steps: step };
        }

        if (safetyCheck.needsConfirmation) {
          console.warn(`[Step ${step}] Action requires human confirmation: ${toolCall.name}`);
          // In production, implement actual human-in-the-loop here
          // For now, we'll log and continue
        }

        // Execute action
        const result = await executor.execute(toolCall);

        // Log step
        const agentStep: AgentStep = {
          step,
          timestamp: Date.now(),
          worldState,
          reasoning,
          toolCall,
          result,
          duration: Date.now() - stepStart
        };

        await this.logger.logStep(agentStep);

        // Store in history
        stepHistory.push({ action: toolCall, result });

        // Check for completion
        if (toolCall.name === 'complete') {
          const success = toolCall.args.success;
          const finalResult = toolCall.args.result || toolCall.args.reason;
          
          await this.logger.completeRun(
            success ? 'completed' : 'failed',
            finalResult
          );

          return { 
            success, 
            result: finalResult, 
            steps: step + 1 
          };
        }

        // If action failed critically, stop
        if (!result.success && this.isCriticalError(result.error)) {
          await this.logger.completeRun('failed', undefined, result.error);
          return { 
            success: false, 
            error: result.error, 
            steps: step + 1 
          };
        }

        // Small delay between actions (be nice to websites)
        await page.waitForTimeout(500);
      }

      // Max steps reached
      await this.logger.completeRun('timeout', undefined, 'Maximum steps reached');
      return { 
        success: false, 
        error: 'Maximum steps reached without completion', 
        steps: maxSteps 
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Agent error:', errorMsg);
      await this.logger.completeRun('failed', undefined, errorMsg);
      return { success: false, error: errorMsg, steps: 0 };

    } finally {
      // Cleanup
      if (page) await page.close().catch(() => {});
      if (context) await context.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
    }
  }

  /**
   * Observe current world state
   */
  private async observeWorld(page: Page, step: number): Promise<WorldState> {
    const url = page.url();
    const title = await page.title().catch(() => undefined);
    const domSummary = await summarizeDOM(page);
    const visibleSelectors = await extractStableSelectors(page);

    return {
      url,
      title,
      domSummary,
      visibleSelectors,
      step,
      timestamp: Date.now()
    };
  }

  /**
   * Determine if an error is critical enough to stop
   */
  private isCriticalError(error?: string): boolean {
    if (!error) return false;
    
    const criticalPatterns = [
      'net::ERR_',
      'Navigation timeout',
      'Browser closed',
      'Context closed'
    ];

    return criticalPatterns.some(pattern => error.includes(pattern));
  }
}

