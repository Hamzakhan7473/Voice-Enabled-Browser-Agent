# 🤖 OpenAI Agent Builder Configuration
## Voice Enabled Browser Agent Integration

Use this configuration to create a custom GPT/Agent that controls your Voice Enabled Browser Agent.

---

## 📋 STEP 1: Basic Information

### Name
```
Voice Browser Agent
```

### Description
```
AI-powered browser automation assistant that can navigate websites, search, extract data, fill forms, and take screenshots using natural language commands.
```

### Instructions (System Prompt)
```
You are a Voice Browser Agent - an AI assistant that can control a web browser to help users automate tasks, research information, and interact with websites.

## Your Capabilities

You can perform browser automation through the following actions:

**Navigation & Interaction:**
- Navigate to any URL
- Click buttons and links
- Fill out forms and input fields
- Scroll pages
- Go back/forward in history

**Data Extraction:**
- Extract text content from pages
- Get page titles and URLs
- Take screenshots
- Export data to CSV/JSON

**Search & Research:**
- Search on Google, Bing, or any search engine
- Open and analyze search results
- Extract information from multiple pages
- Summarize web content

## How You Work

1. **Understand the user's goal** - Listen to what they want to accomplish
2. **Break it down into steps** - Plan the browser actions needed
3. **Execute actions** - Use the browser control API to perform tasks
4. **Provide updates** - Keep the user informed of progress
5. **Return results** - Deliver the information or confirmation

## Guidelines

- **Be proactive**: Suggest helpful actions based on user goals
- **Be clear**: Explain what you're doing before you do it
- **Be safe**: Ask for confirmation before destructive actions
- **Be efficient**: Minimize unnecessary steps
- **Be helpful**: Provide context and summaries

## Example Interactions

User: "Find the weather in New York"
You: "I'll search for the weather in New York for you. Let me navigate to a weather website and extract the forecast."
[Execute: Navigate to weather.com, search for NYC, extract forecast]
You: "Here's the current weather in New York: [weather details]"

User: "Get me the top 5 Hacker News stories"
You: "I'll visit Hacker News and extract the top stories for you."
[Execute: Navigate to news.ycombinator.com, extract top 5 links and titles]
You: "Here are the top 5 Hacker News stories: [list with links]"

## Important Notes

- Always confirm URLs before navigating to unfamiliar sites
- Respect user privacy - never access sensitive information without permission
- If a task seems unclear, ask clarifying questions first
- Provide progress updates for multi-step tasks
- If something fails, explain what happened and suggest alternatives

Your goal is to be a helpful, reliable browser automation assistant that makes web tasks effortless for users.
```

---

## 📋 STEP 2: Conversation Starters

Add these example prompts:

```
1. "Search Google for the latest AI news and summarize the top 3 results"
2. "Go to Hacker News and get me the top 5 trending stories"
3. "Find the weather forecast for San Francisco this week"
4. "Navigate to Wikipedia and search for quantum computing"
```

---

## 📋 STEP 3: Actions (API Configuration)

### Action 1: Browser Control API

**Schema (OpenAPI 3.0)**

```yaml
openapi: 3.0.0
info:
  title: Voice Enabled Browser Agent API
  description: Control a browser automation agent via API
  version: 1.0.0
servers:
  - url: http://localhost:3000
    description: Local development server
paths:
  /health:
    get:
      operationId: checkHealth
      summary: Check if the browser agent is healthy and ready
      responses:
        '200':
          description: Health status
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    example: healthy
                  timestamp:
                    type: string
                  components:
                    type: object

  /agent/run:
    post:
      operationId: runBrowserTask
      summary: Execute a browser automation task
      description: Run a browser automation task with natural language goal
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - goal
              properties:
                goal:
                  type: string
                  description: Natural language description of what to accomplish
                  example: "Go to Google and search for weather in NYC"
                startUrl:
                  type: string
                  description: Optional starting URL
                  example: "https://google.com"
                maxSteps:
                  type: integer
                  description: Maximum number of steps to execute
                  default: 30
                  example: 15
                allowedDomains:
                  type: array
                  items:
                    type: string
                  description: List of allowed domains for safety
                  example: ["google.com", "wikipedia.org"]
                constraints:
                  type: array
                  items:
                    type: string
                  description: Constraints or requirements
                  example: ["Don't click on ads", "Only search results"]
      responses:
        '200':
          description: Task execution result
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  result:
                    type: string
                    description: The result or data extracted
                  steps:
                    type: integer
                    description: Number of steps executed
                  duration:
                    type: integer
                    description: Time taken in milliseconds
                  error:
                    type: string
                    description: Error message if failed
```

### Privacy Policy URL (Optional)
```
https://yourdomain.com/privacy
```

---

## 📋 STEP 4: Copy-Paste Commands

### For Testing Locally

**Health Check:**
```bash
curl http://localhost:3000/health
```

**Run Simple Task:**
```bash
curl -X POST http://localhost:3000/agent/run \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Go to example.com and get the main heading",
    "startUrl": "https://example.com",
    "maxSteps": 3
  }'
```

**Run Complex Task:**
```bash
curl -X POST http://localhost:3000/agent/run \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Search for latest AI breakthroughs on Google and summarize top 3 results",
    "startUrl": "https://google.com",
    "maxSteps": 20,
    "allowedDomains": ["google.com"],
    "constraints": ["Focus on academic or news sources"]
  }'
```

---

## 📋 STEP 5: Example User Interactions

### Example 1: Simple Navigation
**User:** "Go to Hacker News and get the top story"
**Agent Response:**
```
I'll navigate to Hacker News and extract the top story for you.

[Calls: runBrowserTask with goal="Get the top story title and link from Hacker News", startUrl="https://news.ycombinator.com"]

The top story on Hacker News is: "Building Production ML Systems" 
Link: https://example.com/article
```

### Example 2: Research Task
**User:** "Research the latest trends in quantum computing"
**Agent Response:**
```
I'll search for the latest quantum computing trends and summarize what I find.

[Calls: runBrowserTask with goal="Search Google for 'latest quantum computing trends 2025' and summarize top 3 results"]

Here's what I found about quantum computing trends:

1. **Error Correction Breakthroughs** - Researchers achieved 99.9% qubit fidelity...
2. **Commercial Applications** - IBM and Google announced new quantum processors...
3. **Quantum Internet** - Progress in quantum communication networks...

Would you like me to dive deeper into any of these topics?
```

### Example 3: Data Extraction
**User:** "Get me a list of the top 10 GitHub trending repositories"
**Agent Response:**
```
I'll visit GitHub's trending page and extract the top 10 repositories for you.

[Calls: runBrowserTask with goal="Navigate to github.com/trending and extract top 10 repository names, stars, and descriptions"]

Here are the top 10 trending GitHub repositories:

1. **microsoft/autogen** - 45.2k ⭐ - Framework for LLM applications
2. **openai/whisper** - 38.1k ⭐ - Speech recognition model
[... continues]

Would you like me to open any of these repositories or get more details?
```

---

## 📋 STEP 6: Knowledge Base (Optional)

Add this documentation to help the agent understand its capabilities:

```markdown
# Browser Agent Capabilities Reference

## Available Tools

### Navigation
- navigate(url) - Go to a specific URL
- goBack() - Navigate to previous page
- reload() - Refresh current page

### Interaction
- click(selector) - Click an element
- type(selector, text) - Type into input field
- submit(formSelector) - Submit a form
- select(selector, value) - Select dropdown option

### Data Extraction
- extract(mode) - Extract content (article, table, links, raw)
- screenshot() - Capture page screenshot
- getTitle() - Get page title
- getUrl() - Get current URL

### Waiting & Timing
- waitFor(selector|state) - Wait for element or page state
- scroll(direction) - Scroll page

## Best Practices

1. **Start with a clear goal** - Know what you want to accomplish
2. **Use stable selectors** - Prefer data-testid, aria-label, or unique text
3. **Wait appropriately** - Use waitFor when content loads dynamically
4. **Extract strategically** - Use extract() to get clean data
5. **Handle errors gracefully** - Retry with alternative approaches if needed

## Common Patterns

### Search and Extract Pattern
```
1. Navigate to search engine
2. Type search query
3. Wait for results
4. Extract top results
5. Return summarized data
```

### Form Filling Pattern
```
1. Navigate to form page
2. Fill each field with type()
3. Review filled data
4. Submit form
5. Confirm submission
```

### Multi-page Research Pattern
```
1. Search for topic
2. Open top N results
3. Extract key information from each
4. Synthesize findings
5. Return comprehensive summary
```
```

---

## 📋 STEP 7: Advanced Settings

### Model Selection
```
Model: gpt-4-turbo or gpt-4
Temperature: 0.7
```

### Capabilities
- [x] Web Browsing: **Through your custom browser agent**
- [ ] DALL-E: Not needed
- [ ] Code Interpreter: Not needed

### Additional Instructions
```
When executing browser tasks:
1. Always explain what you're about to do
2. Break complex tasks into clear steps
3. Provide progress updates for multi-step operations
4. If something fails, explain why and suggest alternatives
5. Always return actionable results to the user

Safety guidelines:
- Never access authentication pages without explicit permission
- Don't perform actions that could harm user data
- Ask for confirmation before purchases or deletions
- Respect robots.txt and website terms of service
```

---

## 🚀 Quick Setup Commands

### 1. Make Your Server Publicly Accessible (for OpenAI to reach it)

**Option A: Using ngrok (Recommended for testing)**
```bash
# Install ngrok
brew install ngrok

# Authenticate (get free account at ngrok.com)
ngrok config add-authtoken YOUR_NGROK_TOKEN

# Expose your local server
ngrok http 3000
```

Then use the ngrok URL in the OpenAPI schema:
```yaml
servers:
  - url: https://your-ngrok-url.ngrok.io
```

**Option B: Deploy to Cloud**
```bash
# Deploy with Docker
docker-compose up -d

# Or deploy to cloud platform
# (Heroku, AWS, Google Cloud, etc.)
```

### 2. Update the Schema URL

Once you have a public URL, replace `http://localhost:3000` with your public URL in the OpenAPI schema above.

### 3. Test the Integration

```bash
# Test health endpoint
curl https://your-url.com/health

# Test agent run
curl -X POST https://your-url.com/agent/run \
  -H "Content-Type: application/json" \
  -d '{"goal": "Get top Hacker News story"}'
```

---

## 📝 Complete OpenAPI Schema (Copy This)

```yaml
openapi: 3.0.0
info:
  title: Voice Browser Agent API
  description: |
    Control a browser automation agent using natural language commands.
    The agent can navigate websites, extract data, fill forms, and perform complex multi-step tasks.
  version: 2.0.0
servers:
  - url: http://localhost:3000
    description: Local server (use ngrok for public access)
paths:
  /health:
    get:
      operationId: checkAgentHealth
      summary: Check if browser agent is healthy and ready
      description: Returns health status of all agent components
      responses:
        '200':
          description: Agent health status
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    enum: [healthy, unhealthy]
                  timestamp:
                    type: string
                    format: date-time
                  components:
                    type: object
                    description: Status of individual components
                    
  /agent/run:
    post:
      operationId: executeBrowserTask
      summary: Execute a browser automation task
      description: |
        Execute a browser automation task with natural language goal.
        The agent will:
        1. Understand your goal
        2. Plan the necessary steps
        3. Execute browser actions (navigate, click, type, extract)
        4. Return the results
        
        Use this for tasks like:
        - Web searches and data extraction
        - Form filling
        - Multi-page navigation
        - Screenshot capture
        - Content scraping
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - goal
              properties:
                goal:
                  type: string
                  description: Natural language description of the task to accomplish
                  example: "Search Google for 'best pizza in NYC' and extract the top 3 restaurant names with ratings"
                startUrl:
                  type: string
                  format: uri
                  description: Optional starting URL (if not provided, agent will navigate appropriately)
                  example: "https://google.com"
                maxSteps:
                  type: integer
                  minimum: 1
                  maximum: 50
                  default: 30
                  description: Maximum number of browser actions to perform
                allowedDomains:
                  type: array
                  items:
                    type: string
                  description: List of domains the agent is allowed to visit (for safety)
                  example: ["google.com", "yelp.com"]
                constraints:
                  type: array
                  items:
                    type: string
                  description: Additional constraints or requirements
                  example: ["Only open organic results", "Avoid sponsored links"]
                successCriteria:
                  type: array
                  items:
                    type: string
                  description: Criteria for successful task completion
                  example: ["Return at least 3 results", "Include ratings and addresses"]
      responses:
        '200':
          description: Task execution result
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    description: Whether the task was completed successfully
                  result:
                    type: string
                    description: The extracted data or task result
                  steps:
                    type: integer
                    description: Number of browser actions performed
                  duration:
                    type: integer
                    description: Time taken in milliseconds
                  runId:
                    type: string
                    description: Unique identifier for this run
                  error:
                    type: string
                    description: Error message if task failed
        '400':
          description: Invalid request
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
        '500':
          description: Server error
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
```

---

## 🎯 Function Calling Examples

### Example 1: Simple Search
```json
{
  "name": "executeBrowserTask",
  "arguments": {
    "goal": "Search for 'best restaurants in NYC' on Google",
    "startUrl": "https://google.com",
    "maxSteps": 10
  }
}
```

### Example 2: Data Extraction
```json
{
  "name": "executeBrowserTask",
  "arguments": {
    "goal": "Extract the top 5 story titles and links from Hacker News",
    "startUrl": "https://news.ycombinator.com",
    "maxSteps": 5,
    "successCriteria": ["Return at least 5 stories with titles and URLs"]
  }
}
```

### Example 3: Research Task
```json
{
  "name": "executeBrowserTask",
  "arguments": {
    "goal": "Search for 'quantum computing breakthroughs 2025', open the top 3 results, and summarize the key findings",
    "startUrl": "https://google.com",
    "maxSteps": 25,
    "allowedDomains": ["google.com", "arxiv.org", "nature.com", "science.org"],
    "constraints": ["Only visit academic or reputable news sources"]
  }
}
```

---

## 🔒 Security & Privacy Settings

### Privacy Policy Statement
```
This agent connects to a locally running browser automation service.
It can access websites you specify and extract publicly available information.
No data is stored permanently unless explicitly saved by the user.
All browser sessions are temporary and cleaned up after use.
```

### Data Usage
```
- User commands are sent to OpenAI for processing
- Browser automation is performed locally on your machine
- Extracted data is returned to the user via the chat interface
- No browsing history is permanently stored
- Screenshots and logs are temporary and can be cleared
```

---

## 🧪 Testing Your OpenAI Agent

Once configured, test with these prompts:

### Test 1: Simple Navigation
```
User: "What's on the front page of Hacker News right now?"
Expected: Agent uses executeBrowserTask to visit HN and extract top stories
```

### Test 2: Search and Extract
```
User: "Find me the best rated Italian restaurants in Chicago"
Expected: Agent searches Google/Yelp and extracts restaurant data
```

### Test 3: Multi-step Task
```
User: "Research the latest developments in AI safety - check news sites and summarize"
Expected: Agent searches, visits multiple sources, synthesizes information
```

### Test 4: Screenshot
```
User: "Show me what the GitHub homepage looks like"
Expected: Agent navigates to GitHub, takes screenshot, describes it
```

---

## 🌐 Deploying for Production

### Option 1: ngrok (Quick Testing)
```bash
# Start your voice agent
npm run start:legacy

# In another terminal, start ngrok
ngrok http 3000

# Copy the https URL (e.g., https://abc123.ngrok.io)
# Use this URL in the OpenAPI schema servers section
```

### Option 2: Cloud Deployment

**Docker Deployment:**
```bash
# Build and push
docker build -t your-registry/voice-agent .
docker push your-registry/voice-agent

# Deploy to your cloud provider
# Update OpenAPI schema with your production URL
```

**Environment Variables for Production:**
```bash
OPENAI_API_KEY=sk-...
DEEPGRAM_API_KEY=...
BROWSERBASE_API_KEY=...
PORT=3000
HEADLESS=true
ALLOWED_DOMAINS=google.com,wikipedia.org,github.com
```

---

## 📱 Mobile/Public Access

If you want to access from anywhere:

1. **Deploy to cloud** (recommended)
2. **Use ngrok** for temporary public URL
3. **Update OpenAPI schema** with public URL
4. **Add authentication** (API key header)

---

## ✅ Final Checklist

Before creating your OpenAI agent:

- [ ] Voice agent running locally (`npm run start:legacy`)
- [ ] Health endpoint responding (`curl localhost:3000/health`)
- [ ] Agent endpoint tested (`curl -X POST localhost:3000/agent/run ...`)
- [ ] Public URL obtained (ngrok or deployment)
- [ ] OpenAPI schema updated with public URL
- [ ] Privacy policy prepared (if public)
- [ ] Example prompts tested
- [ ] Error handling verified

---

## 🎉 You're Ready!

Copy the configuration above into OpenAI's Agent Builder and you'll have a custom GPT that can control your Voice Enabled Browser Agent!

**Your users will be able to say things like:**
- "Search for the best laptop deals"
- "Get me the weather forecast"
- "Find trending GitHub projects"
- "Research this topic for me"
- "Fill out this form with test data"

And your agent will execute it all automatically! 🚀

