/**
 * Safety & Policy Enforcement
 * Domain allowlisting, rate limiting, human-in-the-loop
 */

import type { SafetyPolicy, ToolCall } from './types.js';

export class SafetyGuard {
  private actionCounts: Map<string, number> = new Map();
  private lastActionTime: Map<string, number> = new Map();
  
  constructor(private policy: SafetyPolicy) {}

  /**
   * Check if a URL is allowed based on policy
   */
  isUrlAllowed(url: string): { allowed: boolean; reason?: string } {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;

      // Check blocklist first
      if (this.policy.blockedDomains) {
        for (const blocked of this.policy.blockedDomains) {
          if (domain.includes(blocked) || this.matchesPattern(domain, blocked)) {
            return { allowed: false, reason: `Domain ${domain} is blocked` };
          }
        }
      }

      // Check allowlist if present
      if (this.policy.allowedDomains && this.policy.allowedDomains.length > 0) {
        let allowed = false;
        for (const allowedDomain of this.policy.allowedDomains) {
          if (domain.includes(allowedDomain) || this.matchesPattern(domain, allowedDomain)) {
            allowed = true;
            break;
          }
        }
        if (!allowed) {
          return { allowed: false, reason: `Domain ${domain} not in allowlist` };
        }
      }

      return { allowed: true };
    } catch (error) {
      return { allowed: false, reason: 'Invalid URL' };
    }
  }

  /**
   * Check if action requires human confirmation
   */
  requiresConfirmation(url: string, toolCall: ToolCall): boolean {
    if (!this.policy.requireConfirmation || this.policy.requireConfirmation.length === 0) {
      return false;
    }

    // Check URL patterns
    const urlLower = url.toLowerCase();
    for (const pattern of this.policy.requireConfirmation) {
      if (urlLower.includes(pattern.toLowerCase())) {
        return true;
      }
    }

    // Red flag actions
    const redFlagKeywords = ['checkout', 'payment', 'credit', 'card', 'purchase', 'buy', 'order', 'confirm', 'delete', 'remove'];
    
    if (toolCall.name === 'click' || toolCall.name === 'type') {
      const argsStr = JSON.stringify(toolCall.args).toLowerCase();
      for (const keyword of redFlagKeywords) {
        if (argsStr.includes(keyword)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check rate limiting
   */
  checkRateLimit(domain: string): { allowed: boolean; reason?: string } {
    if (!this.policy.rateLimitMs) {
      return { allowed: true };
    }

    const now = Date.now();
    const lastAction = this.lastActionTime.get(domain);

    if (lastAction && now - lastAction < this.policy.rateLimitMs) {
      const waitMs = this.policy.rateLimitMs - (now - lastAction);
      return { 
        allowed: false, 
        reason: `Rate limit: wait ${Math.ceil(waitMs / 1000)}s before next action on ${domain}` 
      };
    }

    this.lastActionTime.set(domain, now);
    return { allowed: true };
  }

  /**
   * Check per-domain step budget
   */
  checkStepBudget(domain: string): { allowed: boolean; reason?: string } {
    if (!this.policy.maxStepsPerDomain) {
      return { allowed: true };
    }

    const count = this.actionCounts.get(domain) || 0;
    
    if (count >= this.policy.maxStepsPerDomain) {
      return { 
        allowed: false, 
        reason: `Max steps (${this.policy.maxStepsPerDomain}) reached for ${domain}` 
      };
    }

    this.actionCounts.set(domain, count + 1);
    return { allowed: true };
  }

  /**
   * Full safety check before action
   */
  async checkAction(url: string, toolCall: ToolCall): Promise<{
    allowed: boolean;
    needsConfirmation: boolean;
    reason?: string;
  }> {
    // Skip checks for complete action
    if (toolCall.name === 'complete') {
      return { allowed: true, needsConfirmation: false };
    }

    // Check URL for navigate
    if (toolCall.name === 'navigate') {
      const urlCheck = this.isUrlAllowed(toolCall.args.url);
      if (!urlCheck.allowed) {
        return { allowed: false, needsConfirmation: false, reason: urlCheck.reason };
      }
    }

    // Extract domain
    const domain = new URL(url).hostname;

    // Check rate limit
    const rateCheck = this.checkRateLimit(domain);
    if (!rateCheck.allowed) {
      return { allowed: false, needsConfirmation: false, reason: rateCheck.reason };
    }

    // Check step budget
    const budgetCheck = this.checkStepBudget(domain);
    if (!budgetCheck.allowed) {
      return { allowed: false, needsConfirmation: false, reason: budgetCheck.reason };
    }

    // Check if needs confirmation
    const needsConfirmation = this.requiresConfirmation(url, toolCall);

    return { allowed: true, needsConfirmation };
  }

  /**
   * Simple pattern matching (supports * wildcards)
   */
  private matchesPattern(text: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    
    return new RegExp(`^${regexPattern}$`).test(text);
  }

  /**
   * Reset counters (e.g., between runs)
   */
  reset(): void {
    this.actionCounts.clear();
    this.lastActionTime.clear();
  }
}

