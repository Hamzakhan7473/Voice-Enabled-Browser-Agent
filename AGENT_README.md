# 🤖 Production Browser Agent

A clean, battle-tested, production-grade browser automation agent powered by AI. Think OpenAI's "Operator" but open-source and self-hosted.

## ✨ Features

- **🧠 AI-Powered**: Uses OpenAI GPT-4 with function calling for intelligent web navigation
- **🎯 Reliable**: Built on Playwright with resilient selectors and proper error handling
- **🔒 Safe**: Domain allowlisting, rate limiting, human-in-the-loop for sensitive actions
- **📊 Observable**: Step-by-step logs, screenshots, traces, and markdown reports
- **🚀 Production-Ready**: TypeScript, Docker support, health checks, graceful shutdown
- **🎨 Beautiful UI**: Real-time dashboard for monitoring and triggering runs
- **💾 Memory**: SQLite-based persistent storage for learning from past interactions

## 🏗️ Architecture

```
Controller (Reasoning Loop)
   ↓
Plan → Act → Observe → Critique → Repeat
   ↓
Tools: navigate, click, type, extract, wait, scroll, screenshot
   ↓
Browser Runtime: Playwright (Chromium/Firefox/WebKit)
   ↓
Safety Layer: Domain checks, rate limits, confirmation gates
   ↓
Observability: Logs, screenshots, reports
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- OpenAI API key
- (Optional) Docker for containerized deployment

### Installation

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Set up environment
cp env.example .env
# Edit .env and add your OPENAI_API_KEY
```

### Run in Server Mode

```bash
# Start API server (default port 3000)
npm start

# Or with custom config
PORT=8080 HEADLESS=false npm start
```

Visit `http://localhost:3000/ui/agent.html` for the dashboard.

### Run in CLI Mode

```bash
# Single command execution
npm run cli "Get top 5 Hacker News stories" "https://news.ycombinator.com"

# Or directly
MODE=cli node dist/agent/index.js "Search for best pizza in NYC"
```

## 🐳 Docker Deployment

```bash
# Build and run
docker-compose up

# Or manually
docker build -t browser-agent .
docker run -p 3000:3000 -e OPENAI_API_KEY=your_key browser-agent
```

## 📡 API Reference

### POST `/agent/run`

Start an agent run.

**Request:**
```json
{
  "goal": "Find the cheapest NYC to SFO flight next month",
  "startUrl": "https://google.com/flights",
  "maxSteps": 30,
  "allowedDomains": ["google.com"],
  "constraints": ["Must be non-stop"],
  "successCriteria": ["Return flight details with price"]
}
```

**Response:**
```json
{
  "runId": "1234567890",
  "success": true,
  "result": "Found non-stop flight for $350 on United...",
  "steps": 12,
  "duration": 45000
}
```

### GET `/health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1234567890,
  "activeRuns": 2
}
```

## 🛠️ Configuration

Environment variables:

```bash
# Required
OPENAI_API_KEY=sk-...

# Optional
OPENAI_MODEL=gpt-4-turbo-preview    # LLM model to use
MODE=server                          # "server" or "cli"
PORT=3000                            # Server port
HOST=0.0.0.0                        # Server host
HEADLESS=true                        # Run browser headless
ALLOWED_DOMAINS=example.com,google.com  # Comma-separated allowlist
```

## 📊 Observability

All runs generate:

1. **Step Logs**: JSON logs per step in `./logs/`
2. **Screenshots**: Captured at key moments in `./screenshots/`
3. **Reports**: Markdown summary reports in `./logs/`
4. **Memory**: SQLite database tracking all interactions in `./data/`

Example log structure:
```
logs/
  ├── run-abc123.json              # Full run data
  ├── run-abc123-step-1.json       # Individual steps
  ├── run-abc123-step-2.json
  └── run-abc123-report.md         # Human-readable report
```

## 🔒 Safety & Compliance

The agent is designed to be **safe and compliant**:

✅ **DO:**
- Respect robots.txt (configurable)
- Use rate limiting between actions
- Provide domain allowlists
- Request human confirmation for sensitive actions
- Set step budgets per domain

❌ **DON'T:**
- No CAPTCHA bypassing
- No auth evasion
- No payment processing without explicit user control
- No ToS violations

**Human-in-the-Loop:** Actions matching patterns like "checkout", "payment", "delete" trigger confirmation gates (implement your own approval flow in production).

## 🧪 Testing

```bash
# Run tests
npm test

# Test with a simple goal
npm run cli "Get the title of example.com" "https://example.com"
```

## 📚 Use Cases

- **Research**: "Summarize the top 5 results for quantum computing breakthroughs"
- **Data Extraction**: "Get pricing for all products on this page as CSV"
- **Monitoring**: "Check if my website's contact form works and send a test submission"
- **Shopping**: "Find the best price for iPhone 15 across 3 retailers"
- **News**: "Summarize today's tech headlines from Hacker News"

## 🔧 Advanced: Custom Tools

Add new tools in `src/agent/tools.ts`:

```typescript
{
  type: 'function',
  function: {
    name: 'customAction',
    description: 'What this tool does',
    parameters: { /* JSON schema */ }
  }
}
```

Then implement in `src/agent/tool-executor.ts`.

## 📈 Performance

Typical metrics:
- **Latency**: 3-5s per step (LLM call + browser action)
- **Token usage**: 500-1500 tokens per step
- **Success rate**: 70-90% on well-structured sites
- **Cost**: ~$0.05-0.20 per run (depending on steps and model)

## 🤝 Contributing

This is a production-grade foundation. Extend it:

1. **Add more tools** (API calls, file uploads, etc.)
2. **Implement RAG memory** with embeddings for better context
3. **Add voice interface** (Deepgram/OpenAI Realtime)
4. **Integrate Browserbase** for cloud sessions
5. **Build job queue** (Bull/BullMQ) for async runs

## 📝 License

MIT - Use it for anything!

## 🙋 FAQ

**Q: Why not Puppeteer?**  
A: Playwright is more robust, has better selectors, and official Docker images.

**Q: Can I use Claude/Llama instead of OpenAI?**  
A: Yes! Modify `src/agent/llm-client.ts` to use any provider with function calling.

**Q: How do I handle CAPTCHAs?**  
A: You don't. Use official APIs when available, or pause for human intervention.

**Q: Is this like Selenium?**  
A: No. Selenium is a low-level automation tool. This is a high-level AI agent that reasons about goals and figures out the steps itself.

---

Built with ❤️ for clean, reliable browser automation.

