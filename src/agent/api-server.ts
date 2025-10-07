/**
 * API Server - Fastify with /agent/run endpoint
 * Clean REST API for triggering agent runs
 */

import Fastify, { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import type { AgentGoal, AgentConfig } from './types.js';
import { BrowserAgent } from './browser-agent.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ServerConfig {
  port?: number;
  host?: string;
  agentConfig: AgentConfig;
}

export class AgentAPIServer {
  private fastify: FastifyInstance;
  private agentConfig: AgentConfig;
  private activeRuns: Map<string, { status: string; startTime: number }> = new Map();

  constructor(config: ServerConfig) {
    this.agentConfig = config.agentConfig;
    this.fastify = Fastify({ 
      logger: true,
      bodyLimit: 10485760 // 10MB
    });
    
    this.setupRoutes();
  }

  /**
   * Set up all routes
   */
  private setupRoutes(): void {
    // CORS for browser clients
    this.fastify.register(fastifyCors, {
      origin: true
    });

    // Serve static files (for web UI)
    const publicPath = path.join(__dirname, '../../public');
    this.fastify.register(fastifyStatic, {
      root: publicPath,
      prefix: '/ui/'
    });

    // Health check
    this.fastify.get('/health', async () => {
      return { 
        status: 'ok', 
        timestamp: Date.now(),
        activeRuns: this.activeRuns.size
      };
    });

    // Agent run endpoint
    this.fastify.post<{
      Body: {
        goal: string;
        startUrl?: string;
        constraints?: string[];
        successCriteria?: string[];
        allowedDomains?: string[];
        maxSteps?: number;
      };
    }>('/agent/run', async (request, reply) => {
      try {
        const { goal, startUrl, constraints, successCriteria, allowedDomains, maxSteps } = request.body;

        if (!goal) {
          return reply.code(400).send({ error: 'Goal is required' });
        }

        const agentGoal: AgentGoal = {
          userPrompt: goal,
          constraints,
          successCriteria,
          allowedDomains,
          maxSteps
        };

        // Merge allowed domains with config
        const mergedConfig: AgentConfig = {
          ...this.agentConfig,
          safety: {
            ...this.agentConfig.safety,
            allowedDomains: allowedDomains || this.agentConfig.safety.allowedDomains
          }
        };

        const agent = new BrowserAgent(mergedConfig);
        
        // Track run
        const runId = Date.now().toString();
        this.activeRuns.set(runId, { status: 'running', startTime: Date.now() });

        // Execute (this is synchronous for now; could be made async with job queue)
        const result = await agent.run(agentGoal, startUrl);

        // Update tracking
        this.activeRuns.delete(runId);

        return {
          runId,
          success: result.success,
          result: result.result,
          error: result.error,
          steps: result.steps,
          duration: Date.now() - parseInt(runId)
        };

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        request.log.error(error);
        return reply.code(500).send({ error: errorMsg });
      }
    });

    // Stream run (for future real-time updates)
    this.fastify.get('/agent/stream/:runId', async (_request, reply) => {
      // TODO: Implement SSE streaming for live updates
      return reply.code(501).send({ error: 'Streaming not yet implemented' });
    });

    // Get active runs
    this.fastify.get('/agent/runs', async () => {
      return {
        active: Array.from(this.activeRuns.entries()).map(([id, info]) => ({
          id,
          ...info,
          duration: Date.now() - info.startTime
        }))
      };
    });
  }

  /**
   * Start the server
   */
  async start(port = 3000, host = '0.0.0.0'): Promise<void> {
    try {
      await this.fastify.listen({ port, host });
      console.log(`\n🚀 Agent API Server running on http://${host}:${port}`);
      console.log(`📊 Web UI: http://${host}:${port}/ui/agent.html`);
      console.log(`🔍 Health: http://${host}:${port}/health\n`);
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    await this.fastify.close();
  }
}

