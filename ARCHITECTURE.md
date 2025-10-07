# 🏗️ Architecture Overview

Deep dive into the production browser agent architecture.

## System Design

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Web UI     │  │   REST API   │  │     CLI      │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
          ┌──────────────────▼──────────────────┐
          │      API Server (Fastify)           │
          │  - Routing                          │
          │  - Request validation               │
          │  - Run management                   │
          └──────────────────┬──────────────────┘
                             │
          ┌──────────────────▼──────────────────┐
          │      Browser Agent (Core)           │
          │  ┌──────────────────────────────┐   │
          │  │   Reasoning Loop             │   │
          │  │   Plan → Act → Observe       │   │
          │  └─────────┬────────────────────┘   │
          │            │                         │
          │  ┌─────────▼─────────┐               │
          │  │   LLM Client      │               │
          │  │   (OpenAI GPT-4)  │               │
          │  └─────────┬─────────┘               │
          │            │                         │
          │  ┌─────────▼─────────────────────┐   │
          │  │   Tool Executor               │   │
          │  │   - navigate, click, type     │   │
          │  │   - extract, wait, scroll     │   │
          │  └─────────┬─────────────────────┘   │
          │            │                         │
          │  ┌─────────▼─────────────────────┐   │
          │  │   Playwright Browser          │   │
          │  │   - Chromium/Firefox/WebKit   │   │
          │  └───────────────────────────────┘   │
          └─────────────┬───────────────────────┘
                        │
          ┌─────────────┼───────────────────────┐
          │             │                       │
    ┌─────▼──────┐ ┌───▼───────┐ ┌────▼──────┐
    │  Safety    │ │Observ-    │ │  Memory   │
    │  Guard     │ │ability    │ │  Store    │
    │            │ │           │ │           │
    │ -Allowlist │ │ -Logs     │ │ -SQLite   │
    │ -Rate lim  │ │ -Screen-  │ │ -History  │
    │ -Confirm   │ │  shots    │ │ -Selectors│
    └────────────┘ │ -Reports  │ └───────────┘
                   └───────────┘
```

## Component Breakdown

### 1. Browser Agent (`browser-agent.ts`)

**Responsibility**: Main orchestrator and reasoning loop

**Key methods**:
- `run(goal, startUrl)`: Entry point
- `observeWorld(page)`: Capture current state
- `isCriticalError(error)`: Decide if error is fatal

**Flow**:
```typescript
1. Launch browser
2. For each step (max 30):
   a. Observe world state (DOM summary, selectors)
   b. Ask LLM for next action
   c. Check safety constraints
   d. Execute tool
   e. Log step
   f. Check completion
3. Close browser
4. Return result
```

### 2. LLM Client (`llm-client.ts`)

**Responsibility**: Interface with OpenAI GPT-4 for reasoning

**Key methods**:
- `getNextAction(goal, world, history)`: Get next tool call from LLM
- `buildMessages(...)`: Construct context-rich prompt
- `formatWorldState(world)`: Token-efficient state representation

**Optimization**:
- Only last 5 steps in context (token efficiency)
- Summarized DOM (never raw HTML)
- Grouped selectors by type
- Temperature 0.1 (deterministic)

### 3. Tool Executor (`tool-executor.ts`)

**Responsibility**: Execute browser actions safely

**Tools**:
- `navigate`: Go to URL
- `click`: Click element by selector
- `type`: Fill input field
- `extract`: Pull content (article/table/links/raw)
- `waitFor`: Wait for element or load state
- `screenshot`: Capture page state
- `scroll`: Reveal content
- `query`: Check element properties
- `goBack`: Browser back button
- `complete`: Signal goal completion

**Resilience**:
- Retry on transient failures
- Timeouts on all actions
- Wait for stability before click/type
- Graceful error messages

### 4. DOM Summarizer (`dom-summarizer.ts`)

**Responsibility**: Extract meaningful page state

**Key methods**:
- `summarizeDOM(page)`: Create token-efficient summary
- `extractStableSelectors(page)`: Find reliable targets
- `extractArticle(page)`: Mozilla Readability integration
- `extractTables(page)`: Structured table data
- `extractLinks(page)`: All links with text

**Selector priority**:
1. `data-testid` / `data-test-id`
2. `aria-label`
3. Stable `id` (not auto-generated)
4. Unique `name` attribute
5. Text content (`text="..."`)
6. Role selectors

### 5. Safety Guard (`safety.ts`)

**Responsibility**: Enforce safety policies

**Checks**:
- `isUrlAllowed()`: Domain allowlist/blocklist
- `requiresConfirmation()`: Human-in-the-loop triggers
- `checkRateLimit()`: Cooldown between actions
- `checkStepBudget()`: Max actions per domain

**Red flags**:
- URLs with: checkout, payment, purchase, delete
- Actions on sensitive selectors

### 6. Observability Logger (`observability.ts`)

**Responsibility**: Capture everything for debugging

**Outputs**:
- `{runId}.json`: Full run data
- `{runId}-step-{N}.json`: Per-step logs
- `{runId}-report.md`: Human-readable report
- Console logs with timing

**Metrics tracked**:
- Success/failure rate
- Steps per run
- Duration per step
- Error patterns

### 7. Memory (`memory.ts`)

**Responsibility**: Learn from past interactions

**Storage**:
- **Runs table**: All execution history
- **Page visits table**: URL access patterns
- **Selectors table**: Success/failure rates per domain

**Use cases**:
- Build site-specific selector libraries
- Recall previous visits to URLs
- Track which selectors work reliably
- Aggregate success metrics

### 8. API Server (`api-server.ts`)

**Responsibility**: REST interface for agent

**Endpoints**:
- `POST /agent/run`: Start agent task
- `GET /health`: Server health
- `GET /agent/runs`: List active runs
- `GET /ui/*`: Static web UI

**Features**:
- CORS enabled
- Request validation
- Error handling
- Graceful shutdown

## Data Flow

### Request → Response

```
1. Client sends goal + constraints
   ↓
2. API server validates & creates AgentGoal
   ↓
3. BrowserAgent.run() launched
   ↓
4. For each step:
   a. Playwright captures page state
   b. DOMSummarizer extracts key info
   c. LLMClient asks GPT-4 for next action
   d. SafetyGuard validates action
   e. ToolExecutor runs browser command
   f. ObservabilityLogger records step
   ↓
5. Agent completes (success/failure/timeout)
   ↓
6. API returns result + metadata
   ↓
7. Client receives JSON response
```

### State Management

**WorldState** (ephemeral, per-step):
```typescript
{
  url: string,
  title: string,
  domSummary: string,      // 2-3k chars
  visibleSelectors: [...], // Top 30 actionable elements
  step: number,
  timestamp: number
}
```

**AgentRun** (persistent, full execution):
```typescript
{
  id: string,
  goal: AgentGoal,
  status: 'running' | 'completed' | 'failed',
  steps: AgentStep[],
  startTime: number,
  endTime: number,
  finalResult: string
}
```

## Scalability Considerations

### Current Design (MVP)

- **Concurrency**: One run at a time (synchronous)
- **State**: In-memory during run
- **Browser**: New instance per run

### Production Scaling

1. **Job Queue**: Add Bull/BullMQ for async runs
2. **Browser Pool**: Reuse Playwright contexts
3. **Distributed**: Multiple workers, Redis coordination
4. **Session Management**: Browserbase for cloud browsers
5. **Caching**: Cache DOM summaries, selector mappings

### Resource Limits

- **Memory**: ~300MB per browser instance
- **CPU**: ~1 core per active browser
- **Cost**: ~$0.05-0.20 per run (GPT-4 tokens)
- **Latency**: 3-5s per step average

## Security & Safety

### Threat Model

**Risks mitigated**:
- ✅ Unauthorized site access (allowlist)
- ✅ Rate limiting abuse (cooldowns)
- ✅ Sensitive actions (confirmation gates)
- ✅ Infinite loops (max steps)
- ✅ Data exfiltration (logging only)

**Not protected against** (intentional):
- ❌ CAPTCHA solving (use APIs instead)
- ❌ Auth bypass (respect login walls)
- ❌ Payment processing (never automated)

### Best Practices

1. **Always set allowedDomains** in production
2. **Review logs** after sensitive tasks
3. **Use HTTPS** for API if exposed
4. **Rotate API keys** regularly
5. **Monitor costs** (OpenAI usage)

## Extension Points

### Adding New Tools

1. Define in `tools.ts`:
```typescript
{
  type: 'function' as const,
  function: {
    name: 'myTool',
    description: '...',
    parameters: { /* JSON schema */ }
  }
}
```

2. Implement in `tool-executor.ts`:
```typescript
case 'myTool':
  return await this.myTool(toolCall.args);
```

### Custom LLM Provider

Replace `LLMClient` implementation to use:
- Anthropic Claude
- Google Gemini
- Local LLama via Ollama
- Azure OpenAI

Just maintain the same interface:
```typescript
getNextAction(goal, world, history) -> { toolCall, reasoning }
```

### Memory & RAG

Enhance `memory.ts` to:
- Embed page content with `text-embedding-3-small`
- Store in pgvector or Pinecone
- RAG retrieval of similar past pages
- Pass context to LLM

### Voice Interface

Already scaffolded in legacy code. To integrate:
1. Stream audio → Deepgram/OpenAI Realtime
2. Parse speech → goal/constraints
3. Run agent
4. TTS narrate steps back to user

## Performance Tuning

### Token Optimization

- DOM summary: 2-3k chars max
- Selector list: Top 30 only
- History: Last 5 steps
- **Result**: ~1000 tokens/step average

### Speed Improvements

- Use `domcontentloaded` not `networkidle` (faster)
- Prefer CSS selectors over text (more reliable)
- Cache selector mappings per domain
- Parallel tool calls (future)

### Cost Reduction

- Use `gpt-4o-mini` for simple tasks
- Batch similar goals
- Cache LLM responses (careful!)
- Prefer structured APIs over scraping

## Testing Strategy

### Unit Tests
- Tool executor functions
- Selector extraction logic
- Safety guard rules
- DOM summarization

### Integration Tests
- Full agent runs on mock sites
- API endpoint responses
- Error handling paths

### E2E Tests
- Real websites (stable ones: example.com)
- Success rate metrics
- Cost tracking

## Deployment Checklist

- [ ] Environment variables set
- [ ] OpenAI API key valid
- [ ] Playwright browsers installed (`npx playwright install`)
- [ ] Directories created (logs, screenshots, data)
- [ ] Health check responding
- [ ] HTTPS if public-facing
- [ ] Monitoring/alerts set up
- [ ] Cost limits configured
- [ ] Rate limits appropriate
- [ ] Allowed domains set

---

This architecture is designed to be **clean, extensible, and production-ready** from day one. Every component has a single responsibility and clear interfaces.

