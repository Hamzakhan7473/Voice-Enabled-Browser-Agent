# 🎤 Voice Enabled Browser Agent

Ever wished you could just *talk* to your browser and have it do things for you? Well, now you can! 

This is a voice-powered browser assistant that actually listens to what you say and does it. No more clicking around, no more typing URLs, no more hunting for buttons. Just speak naturally and watch your browser come to life.

Think of it as having a smart assistant that lives inside your browser - one that understands context, remembers what you were doing, and can handle complex multi-step tasks just by listening to your voice.

## ✨ What Makes This Special

- **🎙️ Just Talk**: Speak naturally - "search for laptops under $500" or "click the buy button"
- **🧠 Actually Understands**: Powered by AI that gets what you mean, not just what you say
- **🌐 Real Browser**: Uses actual browsers (not fake ones) so everything works exactly like you expect
- **🔄 Remembers Context**: "Sort by price" works because it remembers you were looking at products
- **📊 Gets Data**: "Extract all the product info" and it actually does it
- **📸 Shows You**: Takes screenshots so you can see what happened
- **🔊 Talks Back**: Tells you what it's doing and when it's done
- **⚡ Fixes Mistakes**: When things go wrong, it tries different approaches
- **💾 Saves Everything**: Exports your session data so you can review what happened
- **🖥️ Beautiful Interface**: Clean, modern web interface that's actually fun to use

## 🚀 Let's Get You Started!

### What You'll Need

First things first - you'll need a few things to get this running:

- **Node.js 18+** (if you don't have it, grab it from [nodejs.org](https://nodejs.org/))
- **Some API keys** (don't worry, they're free to get started!)

### The Easy Way (Recommended)

Just run our installation script and it'll handle everything:

```bash
git clone https://github.com/Hamzakhan7473/Voice-Enabled-Browser-Agent.git
cd Voice-Enabled-Browser-Agent
chmod +x install.sh
./install.sh
```

The script will:
- Install all the dependencies
- Create the necessary folders
- Set up your environment file
- Check if everything looks good

### The Manual Way (If You Prefer)

1. **Get the code**
   ```bash
   git clone https://github.com/Hamzakhan7473/Voice-Enabled-Browser-Agent.git
   cd Voice-Enabled-Browser-Agent
   ```

2. **Install the good stuff**
   ```bash
   npm install
   ```

3. **Set up your secrets** (the API keys)
   ```bash
   cp env.example .env
   ```
   
   Now edit that `.env` file and add your API keys:
   ```env
   # Get these from the websites below - they're free to start!
   DEEPGRAM_API_KEY=your_deepgram_api_key_here
   BROWSERBASE_API_KEY=your_browserbase_api_key_here
   BROWSERBASE_PROJECT_ID=your_project_id_here
   OPENAI_API_KEY=your_openai_api_key_here
   ```

4. **Fire it up!**
   ```bash
   npm start
   ```

5. **Open your browser**
   Go to `http://localhost:3000` and start talking to your browser! 🎤

## 🎯 What Can You Actually Say?

Here's the fun part - you can talk to it like you would talk to a person! Here are some examples:

### Getting Around
- "Go to Google"
- "Navigate to amazon.com"
- "Go back to the previous page"
- "Refresh this page"

### Finding Things
- "Search for wireless headphones"
- "Look for laptops under $800"
- "Click on the login button"
- "Open the second search result"

### Filling Out Forms
- "Fill the email field with john@example.com"
- "Enter my password"
- "Submit this form"

### Getting Information
- "Extract all the product prices"
- "Get me all the links on this page"
- "Save this table data"
- "Show me the product details"

### Controlling the Page
- "Scroll down"
- "Take a screenshot"
- "Wait for the page to finish loading"

### Smart Context Commands
- "Sort by price" (it remembers you were looking at products!)
- "Filter by brand"
- "Open the checkout page"
- "Go to the next page"

The cool thing is that it actually understands context. So if you say "sort by price" after extracting product data, it knows exactly what you mean!

## 🧠 How It Actually Works

Here's the magic behind the scenes (don't worry, it's not as complicated as it looks):

```
You speak → Deepgram listens → OpenAI understands → Browser does it → You see results
```

**The Journey of Your Voice:**
1. **You talk** into your microphone
2. **Deepgram** converts your speech to text (really fast!)
3. **OpenAI** figures out what you actually want to do
4. **Browserbase + Playwright** makes it happen in a real browser
5. **The system** remembers what happened and tells you about it

## 📁 What's Inside

The code is organized into neat little folders:

```
Voice-Enabled-Browser-Agent/
├── src/
│   ├── audio/           # Handles your microphone
│   ├── speech/          # Converts speech to text
│   ├── nlp/             # Understands what you mean
│   ├── browser/         # Controls the browser
│   ├── context/         # Remembers what you were doing
│   ├── feedback/        # Talks back to you
│   ├── core/            # The main brain
│   └── utils/           # Helper functions
├── public/              # The web interface you see
├── exports/             # Your session data
├── screenshots/         # Pictures it takes
├── logs/                # What happened when
└── temp/                # Temporary stuff
```

Each folder has a specific job, and they all work together to make the magic happen!

## 🔧 Making It Your Own

Want to customize things? Here's how:

### Audio Settings
If you want to tweak how it hears you:
```env
AUDIO_SAMPLE_RATE=16000    # How clear the audio is
AUDIO_CHANNELS=1           # Mono or stereo
AUDIO_BIT_DEPTH=16         # Audio quality
```

### Browser Settings
The system automatically picks the best settings for browser automation, but you can customize them if you know what you're doing!

### Understanding Commands
Want to add new voice commands? Check out `src/nlp/IntentParser.js` - that's where the magic of understanding happens.

## 🛠️ For Developers

### Development Mode
```bash
npm run dev
```
This runs with auto-restart so you can see changes immediately.

### Testing Your Changes
```bash
npm test
```

### How the Code Works
- **Everything's Modular**: Each part does one thing well
- **Real-time Communication**: Uses Socket.IO so everything updates instantly
- **Smart Error Handling**: When things break, it tries to fix itself
- **Well Documented**: Lots of comments so you know what's happening

## 📊 Keeping Track of Everything

The system is pretty smart about keeping track of what's happening:

- **Live Status**: You can see if it's connected, what page it's on, and what it's doing
- **Activity Logs**: Every command gets logged with timestamps
- **Error Tracking**: When things go wrong, it remembers and learns from it
- **Performance Stats**: How fast things are working and success rates

## 💾 Saving Your Work

Want to save what happened? You can export everything in different formats:

- **JSON**: All the technical details
- **CSV**: Spreadsheet-friendly data
- **HTML**: Pretty reports you can share
- **Text**: Simple summaries

## 🔒 Keeping Things Safe

Your privacy and security matter:

- **API Keys**: Stored safely in environment variables
- **Confirmation**: Risky actions ask for permission first
- **Isolated Sessions**: Each browser session is separate
- **Cleanup**: Temporary files get deleted automatically

## 🚨 When Things Go Wrong

Don't worry - it's pretty good at fixing itself:

- **Automatic Retry**: If something fails, it tries again (and again)
- **Smart Fallbacks**: If one approach doesn't work, it tries another
- **Asks for Help**: When it's confused, it asks you to clarify
- **Keeps Going**: Even if one thing breaks, everything else keeps working

## 🌐 Works Everywhere

It works with all the major browsers:
- **Chrome/Chromium**: The main one it uses
- **Firefox**: Also supported
- **Safari**: Works on Mac
- **Edge**: Works on Windows

## ⚡ Built for Speed

- **Non-blocking**: Audio processing doesn't slow down other things
- **Smart Memory**: Cleans up after itself automatically
- **Smart Selection**: Picks the best elements to interact with
- **Caching**: Remembers things so it doesn't have to figure them out again

## 🤝 Want to Help?

We'd love your help! Here's how:

1. **Fork** the repository (make your own copy)
2. **Create** a new branch for your feature (`git checkout -b feature/amazing-feature`)
3. **Make** your changes and commit them (`git commit -m 'Add amazing feature'`)
4. **Push** to your branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request and tell us what you built!

## 📄 License

This project is open source under the MIT License - basically, you can use it, modify it, and share it freely!

## 🙏 Thanks to the Amazing People Who Made This Possible

- **[Deepgram](https://deepgram.com/)** - For making speech-to-text actually work well
- **[Browserbase](https://browserbase.com/)** - For reliable browser automation that doesn't break
- **[OpenAI](https://openai.com/)** - For understanding what we actually mean when we talk
- **[Playwright](https://playwright.dev/)** - For controlling browsers like a pro
- **[Socket.IO](https://socket.io/)** - For making everything update in real-time

## 📞 Need Help?

Having trouble? Here's how to get help:

- **GitHub Issues**: Found a bug? Let us know!
- **Discussions**: Want to chat about features? Join the conversation!
- **Email**: For serious stuff, reach out directly

## 🔮 What's Coming Next?

We've got big plans:

- [ ] **Multi-language support** - Talk to it in Spanish, French, etc.
- [ ] **Custom voice commands** - Teach it your own shortcuts
- [ ] **Mobile app** - Control your browser from your phone
- [ ] **Better data visualization** - Pretty charts and graphs
- [ ] **Team features** - Share sessions with your team
- [ ] **Enterprise security** - For the big companies

---

**Built with ❤️ because talking to computers should be as easy as talking to people**
