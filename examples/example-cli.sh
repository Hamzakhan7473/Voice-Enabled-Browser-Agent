#!/bin/bash
# Example CLI usage of the browser agent

echo "🤖 Browser Agent CLI Examples"
echo "=============================="
echo ""

# Make sure to build first
echo "Building TypeScript..."
npm run build
echo ""

# Example 1: Simple page title extraction
echo "Example 1: Get page title"
echo "-------------------------"
MODE=cli node dist/agent/index.js "Get the main heading from example.com" "https://example.com"
echo ""

# Example 2: Hacker News
echo "Example 2: Hacker News top stories"
echo "-----------------------------------"
MODE=cli node dist/agent/index.js "Get the top 5 story titles from Hacker News" "https://news.ycombinator.com"
echo ""

# Example 3: Wikipedia
echo "Example 3: Wikipedia summary"
echo "----------------------------"
MODE=cli node dist/agent/index.js "Summarize the first paragraph about quantum computing" "https://en.wikipedia.org/wiki/Quantum_computing"
echo ""

echo "✅ Examples complete!"
echo ""
echo "Try your own:"
echo 'MODE=cli node dist/agent/index.js "your goal here" "https://starting-url.com"'

