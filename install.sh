#!/bin/bash

# Voice Enabled Browser Agent Installation Script
echo "🎤 Voice Enabled Browser Agent - Installation Script"
echo "=================================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm $(npm -v) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p public screenshots exports archives logs temp context audio

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp env.example .env
    echo "⚠️  Please edit .env file with your API keys:"
    echo "   - DEEPGRAM_API_KEY"
    echo "   - BROWSERBASE_API_KEY"
    echo "   - BROWSERBASE_PROJECT_ID"
    echo "   - OPENAI_API_KEY"
else
    echo "✅ .env file already exists"
fi

# Check for required system dependencies
echo "🔍 Checking system dependencies..."

# Check for audio tools (platform-specific)
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    if ! command -v say &> /dev/null; then
        echo "⚠️  'say' command not found. Text-to-speech may not work."
    else
        echo "✅ macOS TTS available"
    fi
    
    if ! command -v afplay &> /dev/null; then
        echo "⚠️  'afplay' command not found. Audio playback may not work."
    else
        echo "✅ macOS audio playback available"
    fi
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    if ! command -v espeak &> /dev/null; then
        echo "⚠️  'espeak' not found. Install with: sudo apt-get install espeak"
    else
        echo "✅ Linux TTS available"
    fi
    
    if ! command -v aplay &> /dev/null; then
        echo "⚠️  'aplay' not found. Install with: sudo apt-get install alsa-utils"
    else
        echo "✅ Linux audio playback available"
    fi
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    # Windows
    echo "✅ Windows PowerShell TTS should be available"
else
    echo "⚠️  Unknown OS. Some audio features may not work."
fi

# Set up permissions
echo "🔐 Setting up permissions..."
chmod +x src/index.js

echo ""
echo "🎉 Installation completed successfully!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your API keys"
echo "2. Run: npm start"
echo "3. Open: http://localhost:3000"
echo ""
echo "Required API Keys:"
echo "- Deepgram: https://deepgram.com/"
echo "- Browserbase: https://browserbase.com/"
echo "- OpenAI: https://openai.com/"
echo ""
echo "Happy voice browsing! 🎤🌐"
