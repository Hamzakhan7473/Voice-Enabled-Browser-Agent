/**
 * Core types for production-grade browser agent
 * Clean, battle-tested data models
 */

export interface AgentGoal {
  userPrompt: string;
  constraints?: string[];
  successCriteria?: string[];
  allowedDomains?: string[];
  maxSteps?: number;
}

export interface WorldState {
  url: string;
  title?: string;
  domSummary: string;
  visibleSelectors: SelectorInfo[];
  lastAction?: ToolCall;
  lastError?: string;
  memoryRefs?: string[];
  step: number;
  timestamp: number;
}

export interface SelectorInfo {
  selector: string;
  type: 'button' | 'link' | 'input' | 'form' | 'other';
  text?: string;
  role?: string;
  testId?: string;
}

export type ToolCall =
  | { name: 'navigate'; args: { url: string; waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' } }
  | { name: 'query'; args: { selector: string } }
  | { name: 'click'; args: { selector: string; timeout?: number } }
  | { name: 'type'; args: { selector: string; text: string; submit?: boolean; clear?: boolean } }
  | { name: 'extract'; args: { mode: 'article' | 'table' | 'raw' | 'links' } }
  | { name: 'waitFor'; args: { selector?: string; state?: 'networkidle' | 'load' | 'domcontentloaded'; timeout?: number } }
  | { name: 'screenshot'; args: { purpose?: string; fullPage?: boolean } }
  | { name: 'scroll'; args: { direction: 'down' | 'up' | 'top' | 'bottom'; amount?: number } }
  | { name: 'evaluate'; args: { script: string; purpose?: string } }
  | { name: 'goBack'; args: {} }
  | { name: 'complete'; args: { success: boolean; result?: string; reason?: string } };

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  screenshot?: string;
  selector?: string;
}

export interface AgentStep {
  step: number;
  timestamp: number;
  worldState: WorldState;
  reasoning?: string;
  toolCall: ToolCall;
  result: ToolResult;
  duration: number;
}

export interface AgentRun {
  id: string;
  goal: AgentGoal;
  status: 'running' | 'completed' | 'failed' | 'timeout';
  steps: AgentStep[];
  startTime: number;
  endTime?: number;
  finalResult?: string;
  error?: string;
}

export interface SafetyPolicy {
  allowedDomains?: string[];
  blockedDomains?: string[];
  requireConfirmation?: string[]; // URL patterns that need human approval
  maxStepsPerDomain?: number;
  rateLimitMs?: number; // cooldown between actions
  respectRobotsTxt?: boolean;
  userAgent?: string;
}

export interface ExtractedContent {
  title?: string;
  byline?: string;
  content: string;
  textContent: string;
  excerpt?: string;
  length?: number;
  siteName?: string;
  links?: Array<{ text: string; href: string }>;
  tables?: Array<Record<string, any>[]>;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_calls?: any[];
}

export interface AgentConfig {
  llm: {
    model: string;
    temperature?: number;
    maxTokens?: number;
  };
  browser: {
    headless?: boolean;
    userAgent?: string;
    viewport?: { width: number; height: number };
  };
  safety: SafetyPolicy;
  observability: {
    screenshotsDir?: string;
    tracesDir?: string;
    logsDir?: string;
  };
  memory?: {
    enabled: boolean;
    vectorStore?: 'none' | 'local' | 'pgvector';
  };
}

