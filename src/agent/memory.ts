/**
 * Memory Layer - Simple persistent storage for agent runs
 * SQLite-based storage for page visits, embeddings (future), and history
 */

import Database from 'better-sqlite3';
import type { AgentRun, WorldState } from './types.js';
import * as path from 'path';
import * as fs from 'fs';

export class AgentMemory {
  private db: Database.Database;

  constructor(dbPath: string = './data/agent-memory.db') {
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.initializeSchema();
  }

  /**
   * Initialize database schema
   */
  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        goal TEXT NOT NULL,
        status TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER,
        steps_count INTEGER DEFAULT 0,
        success INTEGER DEFAULT 0,
        final_result TEXT,
        error TEXT,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS page_visits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        url TEXT NOT NULL,
        title TEXT,
        timestamp INTEGER NOT NULL,
        dom_summary TEXT,
        action_taken TEXT,
        FOREIGN KEY (run_id) REFERENCES runs(id)
      );

      CREATE TABLE IF NOT EXISTS selectors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain TEXT NOT NULL,
        selector TEXT NOT NULL,
        selector_type TEXT,
        label TEXT,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        last_used INTEGER,
        UNIQUE(domain, selector)
      );

      CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
      CREATE INDEX IF NOT EXISTS idx_page_visits_run ON page_visits(run_id);
      CREATE INDEX IF NOT EXISTS idx_page_visits_url ON page_visits(url);
      CREATE INDEX IF NOT EXISTS idx_selectors_domain ON selectors(domain);
    `);
  }

  /**
   * Start tracking a new run
   */
  saveRun(run: AgentRun): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO runs (id, goal, status, start_time, end_time, steps_count, success, final_result, error, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      run.id,
      run.goal.userPrompt,
      run.status,
      run.startTime,
      run.endTime || null,
      run.steps.length,
      run.status === 'completed' ? 1 : 0,
      run.finalResult || null,
      run.error || null,
      JSON.stringify({ constraints: run.goal.constraints, successCriteria: run.goal.successCriteria })
    );
  }

  /**
   * Record a page visit
   */
  savePageVisit(runId: string, worldState: WorldState, action?: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO page_visits (run_id, url, title, timestamp, dom_summary, action_taken)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      runId,
      worldState.url,
      worldState.title || null,
      worldState.timestamp,
      worldState.domSummary.slice(0, 5000), // Limit size
      action || null
    );
  }

  /**
   * Record selector usage (for building site-specific selector libraries)
   */
  recordSelectorUse(domain: string, selector: string, selectorType: string, label: string, success: boolean): void {
    const existing = this.db.prepare('SELECT * FROM selectors WHERE domain = ? AND selector = ?').get(domain, selector) as any;

    if (existing) {
      this.db.prepare(`
        UPDATE selectors 
        SET success_count = success_count + ?,
            failure_count = failure_count + ?,
            last_used = ?
        WHERE domain = ? AND selector = ?
      `).run(success ? 1 : 0, success ? 0 : 1, Date.now(), domain, selector);
    } else {
      this.db.prepare(`
        INSERT INTO selectors (domain, selector, selector_type, label, success_count, failure_count, last_used)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(domain, selector, selectorType, label, success ? 1 : 0, success ? 0 : 1, Date.now());
    }
  }

  /**
   * Get best selectors for a domain (high success rate)
   */
  getBestSelectors(domain: string, limit: number = 20): Array<{
    selector: string;
    type: string;
    label: string;
    successRate: number;
  }> {
    const rows = this.db.prepare(`
      SELECT 
        selector,
        selector_type as type,
        label,
        success_count,
        failure_count,
        (CAST(success_count AS REAL) / (success_count + failure_count + 1)) as success_rate
      FROM selectors
      WHERE domain = ?
      ORDER BY success_rate DESC, success_count DESC
      LIMIT ?
    `).all(domain, limit) as any[];

    return rows.map(row => ({
      selector: row.selector,
      type: row.type,
      label: row.label,
      successRate: row.success_rate
    }));
  }

  /**
   * Get previous visits to a URL (for context)
   */
  getPreviousVisits(url: string, limit: number = 5): Array<{
    timestamp: number;
    action: string;
    summary: string;
  }> {
    const rows = this.db.prepare(`
      SELECT timestamp, action_taken, dom_summary
      FROM page_visits
      WHERE url = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(url, limit) as any[];

    return rows.map(row => ({
      timestamp: row.timestamp,
      action: row.action_taken || 'visited',
      summary: row.dom_summary?.slice(0, 500) || ''
    }));
  }

  /**
   * Get run statistics
   */
  getStats(): {
    totalRuns: number;
    successfulRuns: number;
    averageSteps: number;
    successRate: number;
  } {
    const stats = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(success) as successful,
        AVG(steps_count) as avg_steps
      FROM runs
      WHERE status IN ('completed', 'failed')
    `).get() as any;

    return {
      totalRuns: stats.total || 0,
      successfulRuns: stats.successful || 0,
      averageSteps: Math.round(stats.avg_steps || 0),
      successRate: stats.total > 0 ? (stats.successful / stats.total) * 100 : 0
    };
  }

  /**
   * Close database
   */
  close(): void {
    this.db.close();
  }
}

