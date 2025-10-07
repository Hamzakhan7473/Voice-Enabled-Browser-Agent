# 🚀 Quick Start Guide

Get your production browser agent running in 5 minutes.

## Prerequisites

- Node.js 20+ installed
- OpenAI API key
- Terminal access

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Set Up Environment

Create a `.env` file in the project root:

```bash
OPENAI_API_KEY=sk-your-openai-key-here
OPENAI_MODEL=gpt-4-turbo-preview
```

## Step 3: Build the Project

```bash
npm run build
```

## Step 4: Run Your First Agent

### Option A: Web Dashboard (Recommended)

```bash
npm start
```

Then open your browser to:
```
http://localhost:3000/ui/agent.html
```

Try one of these examples:
- "Get the top 5 stories from Hacker News"
- "Search for AI news on Google and summarize top 3 results"
- "Find the weather forecast for San Francisco"

### Option B: Command Line

```bash
npm run cli "Get top stories from Hacker News" "https://news.ycombinator.com"
```

## Example Output

```
🚀 Starting browser agent...
📋 Goal: Get top 5 stories from Hacker News
🌐 Start URL: https://news.ycombinator.com

[Step 0] navigate(...) → ✓ (2341ms)
[Step 1] extract(mode: links) → ✓ (1823ms)
[Step 2] complete(success: true) → ✓ (45ms)

✅ Success!
📊 Result: Found top 5 stories:
1. AI Breakthroughs in 2024
2. Building Production ML Systems
3. ...
🔢 Steps: 3
```

## 📊 Monitoring

All runs generate:

- **Logs**: `./logs/run-*.json`
- **Screenshots**: `./screenshots/step-*.png`
- **Reports**: `./logs/run-*-report.md`

View the markdown report for a human-readable summary of each run.

## 🔧 Configuration

Edit your `.env` file to customize:

```bash
# Run headless or see browser
HEADLESS=true

# Restrict to specific domains
ALLOWED_DOMAINS=google.com,wikipedia.org,github.com

# Change server port
PORT=3000

# Use different model
OPENAI_MODEL=gpt-4
```

## 🐳 Docker (Production)

```bash
# Build and run
docker-compose up

# Or manually
docker build -t browser-agent .
docker run -p 3000:3000 -e OPENAI_API_KEY=your_key browser-agent
```

Access the web UI at `http://localhost:3000/ui/agent.html`

## 📡 API Usage

### cURL Example

```bash
curl -X POST http://localhost:3000/agent/run \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Find the top trending repository on GitHub",
    "startUrl": "https://github.com/trending",
    "maxSteps": 10
  }'
```

### JavaScript Example

```javascript
const response = await fetch('http://localhost:3000/agent/run', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    goal: 'Get weather for NYC',
    startUrl: 'https://weather.com',
    maxSteps: 15,
    allowedDomains: ['weather.com']
  })
});

const result = await response.json();
console.log(result.success, result.result);
```

### Python Example

```python
import requests

response = requests.post('http://localhost:3000/agent/run', json={
    'goal': 'Find cheapest iPhone 15 on Amazon',
    'startUrl': 'https://amazon.com',
    'maxSteps': 20,
    'constraints': ['Must be new, not refurbished'],
    'successCriteria': ['Return product name, price, and link']
})

result = response.json()
print(f"Success: {result['success']}")
print(f"Result: {result['result']}")
print(f"Steps: {result['steps']}")
```

## 🎯 Common Use Cases

### 1. Web Research

```json
{
  "goal": "Research the latest trends in quantum computing",
  "startUrl": "https://scholar.google.com",
  "maxSteps": 20
}
```

### 2. Data Extraction

```json
{
  "goal": "Extract all product names and prices from this page",
  "startUrl": "https://example.com/products",
  "successCriteria": ["Return as structured JSON"]
}
```

### 3. Form Filling

```json
{
  "goal": "Fill out the contact form with test data",
  "startUrl": "https://example.com/contact",
  "constraints": ["Use fake data, don't actually submit"]
}
```

### 4. Monitoring

```json
{
  "goal": "Check if the login page loads and form is functional",
  "startUrl": "https://myapp.com/login"
}
```

## 🔒 Safety Tips

1. **Always use allowedDomains** for production to restrict where the agent can go
2. **Set reasonable maxSteps** (10-30) to prevent runaway costs
3. **Test in sandbox first** with `HEADLESS=false` to watch what it does
4. **Review logs** after each run to understand behavior
5. **Use constraints** to guide the agent's actions

## 🐛 Troubleshooting

### "Command not found: tsc"

```bash
npm install
```

### "OPENAI_API_KEY not set"

Create a `.env` file with your API key.

### "Port 3000 already in use"

Change the port:
```bash
PORT=8080 npm start
```

### Agent is slow

This is normal - each step involves:
1. LLM reasoning (1-2s)
2. Browser action (0.5-3s)
3. Page observation (0.5-1s)

Total: 3-5s per step

### Agent can't find elements

The agent uses AI to pick selectors. If it fails:
- Pages with complex/changing layouts are harder
- Try providing a more specific goal
- Check the logs to see what selectors it tried

## 📚 Next Steps

- Read [AGENT_README.md](./AGENT_README.md) for architecture details
- Explore the code in `src/agent/`
- Add custom tools in `src/agent/tools.ts`
- Integrate with your app via the REST API

## 💬 Examples That Work Well

✅ Good:
- "Get top 5 Hacker News stories"
- "Search for X and summarize top 3 results"
- "Extract table data from this page"
- "Find product price on this page"

❌ Avoid:
- Tasks requiring authentication (the agent doesn't log in)
- Sites with heavy JavaScript SPAs (may time out)
- CAPTCHA-protected sites (agent won't bypass)
- Complex multi-step checkout flows (unsafe)

---

Happy automating! 🎉

