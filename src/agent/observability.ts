/**
 * Observability - Step logging, tracing, reporting
 * Structured logs for debugging and monitoring
 */

import type { AgentRun, AgentStep, AgentGoal } from './types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export class ObservabilityLogger {
  private logsDir: string;
  private currentRun?: AgentRun;

  constructor(config: { logsDir?: string } = {}) {
    this.logsDir = config.logsDir || './logs';
  }

  /**
   * Start a new agent run
   */
  async startRun(id: string, goal: AgentGoal): Promise<void> {
    this.currentRun = {
      id,
      goal,
      status: 'running',
      steps: [],
      startTime: Date.now()
    };

    await this.ensureDir(this.logsDir);
    await this.writeRunLog('started');
  }

  /**
   * Log a completed step
   */
  async logStep(step: AgentStep): Promise<void> {
    if (!this.currentRun) {
      console.error('No active run to log step to');
      return;
    }

    this.currentRun.steps.push(step);

    // Write individual step log
    const stepLog = {
      runId: this.currentRun.id,
      step: step.step,
      timestamp: step.timestamp,
      url: step.worldState.url,
      action: step.toolCall,
      result: {
        success: step.result.success,
        error: step.result.error,
        screenshot: step.result.screenshot
      },
      duration: step.duration,
      reasoning: step.reasoning
    };

    console.log(`[Step ${step.step}] ${step.toolCall.name}(${JSON.stringify(step.toolCall.args).slice(0, 100)}) → ${step.result.success ? '✓' : '✗'} (${step.duration}ms)`);
    
    await this.writeStepLog(step.step, stepLog);
  }

  /**
   * Complete the run with final status
   */
  async completeRun(status: 'completed' | 'failed' | 'timeout', finalResult?: string, error?: string): Promise<void> {
    if (!this.currentRun) return;

    this.currentRun.status = status;
    this.currentRun.endTime = Date.now();
    this.currentRun.finalResult = finalResult;
    this.currentRun.error = error;

    await this.writeRunLog('completed');
    await this.generateReport();

    const duration = (this.currentRun.endTime - this.currentRun.startTime) / 1000;
    console.log(`\n[Run ${this.currentRun.id}] ${status.toUpperCase()} in ${duration.toFixed(2)}s (${this.currentRun.steps.length} steps)`);
  }

  /**
   * Get current run info
   */
  getCurrentRun(): AgentRun | undefined {
    return this.currentRun;
  }

  /**
   * Generate markdown report
   */
  private async generateReport(): Promise<void> {
    if (!this.currentRun) return;

    const run = this.currentRun;
    const duration = run.endTime ? (run.endTime - run.startTime) / 1000 : 0;

    let report = `# Agent Run Report\n\n`;
    report += `**Run ID:** ${run.id}\n`;
    report += `**Status:** ${run.status}\n`;
    report += `**Duration:** ${duration.toFixed(2)}s\n`;
    report += `**Steps:** ${run.steps.length}\n\n`;

    report += `## Goal\n\n`;
    report += `${run.goal.userPrompt}\n\n`;

    if (run.goal.constraints && run.goal.constraints.length > 0) {
      report += `**Constraints:**\n`;
      run.goal.constraints.forEach(c => report += `- ${c}\n`);
      report += `\n`;
    }

    report += `## Execution Steps\n\n`;

    for (const step of run.steps) {
      report += `### Step ${step.step}: ${step.toolCall.name}\n\n`;
      
      if (step.reasoning) {
        report += `**Reasoning:** ${step.reasoning}\n\n`;
      }

      report += `**Action:** \`${step.toolCall.name}(${JSON.stringify(step.toolCall.args)})\`\n\n`;
      report += `**Result:** ${step.result.success ? '✓ Success' : '✗ Failed'}\n\n`;

      if (step.result.error) {
        report += `**Error:** ${step.result.error}\n\n`;
      }

      if (step.result.screenshot) {
        report += `**Screenshot:** [View](${step.result.screenshot})\n\n`;
      }

      report += `**Duration:** ${step.duration}ms\n`;
      report += `**URL:** ${step.worldState.url}\n\n`;
      report += `---\n\n`;
    }

    report += `## Final Result\n\n`;
    if (run.finalResult) {
      report += `${run.finalResult}\n\n`;
    } else if (run.error) {
      report += `**Error:** ${run.error}\n\n`;
    }

    const reportPath = path.join(this.logsDir, `${run.id}-report.md`);
    await fs.writeFile(reportPath, report);
    console.log(`Report generated: ${reportPath}`);
  }

  /**
   * Write run-level log
   */
  private async writeRunLog(_event: 'started' | 'completed'): Promise<void> {
    if (!this.currentRun) return;

    const logPath = path.join(this.logsDir, `${this.currentRun.id}.json`);
    await fs.writeFile(logPath, JSON.stringify(this.currentRun, null, 2));
  }

  /**
   * Write individual step log
   */
  private async writeStepLog(stepNum: number, log: any): Promise<void> {
    if (!this.currentRun) return;

    const logPath = path.join(this.logsDir, `${this.currentRun.id}-step-${stepNum}.json`);
    await fs.writeFile(logPath, JSON.stringify(log, null, 2));
  }

  /**
   * Ensure directory exists
   */
  private async ensureDir(dir: string): Promise<void> {
    await fs.mkdir(dir, { recursive: true });
  }
}

