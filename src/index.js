import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import VoiceAgent from './core/VoiceAgent.js';
import AudioCapture from './audio/AudioCapture.js';
import SpeechToText from './speech/SpeechToText.js';
import IntentParser from './nlp/IntentParser.js';
import BrowserController from './browser/BrowserController.js';
import ContextManager from './context/ContextManager.js';
import FeedbackSystem from './feedback/FeedbackSystem.js';
import ErrorHandler from './utils/ErrorHandler.js';

dotenv.config();

class VoiceEnabledBrowserAgent {
  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.port = process.env.PORT || 3000;
    this.setupMiddleware();
    this.setupRoutes();
    this.initializeComponents();
    this.setupSocketHandlers();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.static('public'));
  }

  setupRoutes() {
    this.app.get('/', (req, res) => {
      res.sendFile('index.html', { root: 'public' });
    });

    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });
  }

  async initializeComponents() {
    try {
      // Initialize core components
      this.audioCapture = new AudioCapture();
      this.speechToText = new SpeechToText();
      this.intentParser = new IntentParser();
      this.browserController = new BrowserController();
      this.contextManager = new ContextManager();
      this.feedbackSystem = new FeedbackSystem();
      this.errorHandler = new ErrorHandler();

      // Initialize the main voice agent
      this.voiceAgent = new VoiceAgent({
        audioCapture: this.audioCapture,
        speechToText: this.speechToText,
        intentParser: this.intentParser,
        browserController: this.browserController,
        contextManager: this.contextManager,
        feedbackSystem: this.feedbackSystem,
        errorHandler: this.errorHandler
      });

      console.log('✅ All components initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize components:', error);
      process.exit(1);
    }
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log('🔌 Client connected:', socket.id);

      socket.on('start-listening', async () => {
        try {
          await this.voiceAgent.startListening(socket);
        } catch (error) {
          socket.emit('error', { message: 'Failed to start listening', error: error.message });
        }
      });

      socket.on('stop-listening', async () => {
        try {
          await this.voiceAgent.stopListening();
        } catch (error) {
          socket.emit('error', { message: 'Failed to stop listening', error: error.message });
        }
      });

      socket.on('execute-command', async (command) => {
        try {
          await this.voiceAgent.executeCommand(command, socket);
        } catch (error) {
          socket.emit('error', { message: 'Failed to execute command', error: error.message });
        }
      });

      socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
      });
    });
  }

  start() {
    this.server.listen(this.port, () => {
      console.log(`🚀 Voice Enabled Browser Agent running on port ${this.port}`);
      console.log(`📱 Web interface: http://localhost:${this.port}`);
    });
  }
}

// Start the application
const agent = new VoiceEnabledBrowserAgent();
agent.start();

export default VoiceEnabledBrowserAgent;
