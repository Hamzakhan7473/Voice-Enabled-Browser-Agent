# 🎤 Voice Enabled Browser Agent

A sophisticated voice-enabled browser automation agent that listens to natural speech, converts it into structured commands, and executes them inside a real browser session. The system leverages speech-to-text for transcription, an intent parser to transform spoken language into structured JSON instructions, and Browserbase for reliable headless browser automation.

## ✨ Features

- **🎙️ Voice Input**: Real-time speech-to-text using Deepgram
- **🧠 Intent Parsing**: AI-powered natural language understanding with OpenAI
- **🌐 Browser Automation**: Reliable browser control via Browserbase and Playwright
- **🔄 Context Awareness**: Multi-turn conversation support with context management
- **📊 Data Extraction**: Extract structured data from web pages
- **📸 Screenshots**: Capture page screenshots for transparency
- **🔊 Text-to-Speech**: Audio feedback for command execution
- **⚡ Error Recovery**: Intelligent error handling and retry mechanisms
- **💾 Export & Archive**: Session data export in multiple formats
- **🖥️ Web Interface**: Modern, responsive web UI for control and monitoring

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Deepgram API key
- Browserbase API key and project ID
- OpenAI API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Hamzakhan7473/Voice-Enabled-Browser-Agent.git
   cd Voice-Enabled-Browser-Agent
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` with your API keys:
   ```env
   # Deepgram API Configuration
   DEEPGRAM_API_KEY=your_deepgram_api_key_here
   
   # Browserbase Configuration
   BROWSERBASE_API_KEY=your_browserbase_api_key_here
   BROWSERBASE_PROJECT_ID=your_project_id_here
   
   # OpenAI Configuration
   OPENAI_API_KEY=your_openai_api_key_here
   
   # Server Configuration
   PORT=3000
   NODE_ENV=development
   ```

4. **Start the application**
   ```bash
   npm start
   ```

5. **Open the web interface**
   Navigate to `http://localhost:3000` in your browser.

## 🎯 Supported Commands

The agent supports a wide range of voice commands:

### Navigation
- "Navigate to [URL]"
- "Go back to the previous page"
- "Refresh the page"
- "Open [website name]"

### Search & Interaction
- "Search for [query]"
- "Click on [element]"
- "Click the [button/link] button"
- "Open the second result"

### Form Filling
- "Fill the email field with [email]"
- "Enter [text] in the [field] field"
- "Submit the form"

### Data Extraction
- "Extract all links from this page"
- "Get the product information"
- "Extract the table data"
- "Save the page content"

### Page Control
- "Scroll down"
- "Scroll up"
- "Take a screenshot"
- "Wait for the page to load"

### Context-Aware Commands
- "Sort by price" (after extracting product data)
- "Filter by [criteria]"
- "Open the next page"
- "Go to the checkout"

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Audio Input   │───▶│ Speech-to-Text  │───▶│  Intent Parser  │
│   (Microphone)  │    │   (Deepgram)    │    │    (OpenAI)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Browser       │◀───│ Command Executor │◀───│ Context Manager │
│ (Browserbase +  │    │                 │    │                 │
│   Playwright)   │    └─────────────────┘    └─────────────────┘
└─────────────────┘
         │
┌─────────────────┐
│ Feedback System │
│ (TTS + Logging) │
└─────────────────┘
```

## 📁 Project Structure

```
Voice-Enabled-Browser-Agent/
├── src/
│   ├── audio/           # Audio capture and processing
│   ├── speech/          # Speech-to-text integration
│   ├── nlp/             # Natural language processing
│   ├── browser/         # Browser automation
│   ├── context/         # Context management
│   ├── feedback/        # Feedback and TTS
│   ├── core/            # Core agent logic
│   └── utils/           # Utility functions
├── public/              # Web interface
├── exports/             # Session exports
├── archives/            # Session archives
├── screenshots/         # Captured screenshots
├── logs/                # Application logs
└── temp/                # Temporary files
```

## 🔧 Configuration

### Audio Settings
```env
AUDIO_SAMPLE_RATE=16000
AUDIO_CHANNELS=1
AUDIO_BIT_DEPTH=16
```

### Browser Settings
The agent automatically configures Browserbase sessions with optimal settings for automation.

### Intent Parser Settings
Customize the intent parser behavior in `src/nlp/IntentParser.js`:
- Supported intents
- Parameter validation
- Confidence thresholds
- Risk assessment

## 🛠️ Development

### Running in Development Mode
```bash
npm run dev
```

### Testing
```bash
npm test
```

### Code Structure
- **Modular Design**: Each component is independently testable
- **Event-Driven**: Uses Socket.IO for real-time communication
- **Error Handling**: Comprehensive error recovery and logging
- **Type Safety**: JSDoc annotations for better IDE support

## 📊 Monitoring & Logging

The agent provides comprehensive monitoring:

- **Real-time Status**: Connection status, browser state, current page
- **Activity Logs**: Detailed execution logs with timestamps
- **Error Tracking**: Error history and recovery attempts
- **Performance Metrics**: Execution times and success rates

## 💾 Data Export

Export session data in multiple formats:

- **JSON**: Complete session data with metadata
- **CSV**: Tabular data for analysis
- **HTML**: Human-readable reports
- **Text**: Simple text summaries

## 🔒 Security & Privacy

- **API Key Protection**: Environment variables for sensitive data
- **Confirmation Dialogs**: High-risk actions require explicit confirmation
- **Session Isolation**: Each session runs in isolated browser context
- **Data Cleanup**: Automatic cleanup of temporary files

## 🚨 Error Handling

The agent includes sophisticated error handling:

- **Automatic Retry**: Failed actions are retried with exponential backoff
- **Fallback Strategies**: Alternative approaches for common failures
- **User Clarification**: Prompts for clarification when commands are ambiguous
- **Graceful Degradation**: Continues operation despite individual failures

## 🌐 Browser Compatibility

The agent works with:
- **Chrome/Chromium**: Primary browser engine
- **Firefox**: Supported via Playwright
- **Safari**: Supported via Playwright
- **Edge**: Supported via Playwright

## 📈 Performance

- **Concurrent Processing**: Non-blocking audio processing
- **Memory Management**: Automatic cleanup of resources
- **Optimized Selectors**: Smart element selection strategies
- **Caching**: Context and session data caching

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Deepgram](https://deepgram.com/) for speech-to-text capabilities
- [Browserbase](https://browserbase.com/) for reliable browser automation
- [OpenAI](https://openai.com/) for natural language understanding
- [Playwright](https://playwright.dev/) for browser automation
- [Socket.IO](https://socket.io/) for real-time communication

## 📞 Support

For support, email support@voicebrowseragent.com or join our Discord community.

## 🔮 Roadmap

- [ ] Multi-language support
- [ ] Custom voice commands
- [ ] Mobile app integration
- [ ] Advanced data visualization
- [ ] Team collaboration features
- [ ] Enterprise security features

---

**Built with ❤️ for the future of voice-controlled computing**
