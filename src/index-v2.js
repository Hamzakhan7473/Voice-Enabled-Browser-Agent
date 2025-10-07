import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { VoiceAgentV2 } from './core/VoiceAgentV2.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class VoiceEnabledBrowserAgentV2 {
  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.voiceAgent = new VoiceAgentV2();
    this.port = parseInt(process.env.PORT) || 3001;
    
    this.setupRoutes();
    this.setupSocket();
    this.setupVoiceAgentEvents();
  }

  setupRoutes() {
    // Serve static files
    this.app.use(express.static(path.join(__dirname, '../public')));
    
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        components: {
          voiceAgent: true,
          speechToText: true,
          browserExec: true,
          computerUseAgent: true
        }
      });
    });

    // Root route
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../public/index.html'));
    });
  }

  setupSocket() {
    this.io.on('connection', (socket) => {
      console.log('🔌 Client connected:', socket.id);

      // Send browser initialization status immediately if browser is ready
      if (this.voiceAgent.page) {
        const sessionId = this.voiceAgent.page._browserbaseSessionId || 'local-playwright';
        console.log('📢 Sending browser initialization status to new client');
        socket.emit('browser-initialized', {
          status: 'success',
          sessionId: sessionId,
          pageTitle: 'Agent Ready',
          message: 'Voice Agent V2 browser ready'
        });
      }

      // Handle voice listening commands
      socket.on('start-listening', async () => {
        try {
          await this.voiceAgent.startListening();
          socket.emit('listening-started');
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      socket.on('stop-listening', async () => {
        try {
          await this.voiceAgent.stopListening();
          socket.emit('listening-stopped');
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      // Handle audio data from frontend
      socket.on('audio-data', (data) => {
        try {
          this.voiceAgent.handleFrontendAudio(data.audio);
        } catch (error) {
          socket.emit('error', { message: 'Audio processing failed' });
        }
      });

      // Handle browser initialization request from frontend
      socket.on('initialize-browser', async () => {
        try {
          console.log('🌐 Browser initialization requested by frontend');
          
          // Emit initializing status
          socket.emit('browser-initializing', {
            message: 'Opening browser window...'
          });
          
          // Initialize the browser if not already done
          if (!this.voiceAgent.page) {
            await this.voiceAgent.initialize();
          }
          
          // Get current page info
          let pageTitle = 'Browser Ready';
          let currentUrl = 'about:blank';
          let sessionId = 'local-fallback';
          
          if (this.voiceAgent.page) {
            try {
              // Check if page is still valid before accessing properties
              if (!this.voiceAgent.page.isClosed()) {
                pageTitle = await this.voiceAgent.page.title();
                currentUrl = this.voiceAgent.page.url();
                sessionId = this.voiceAgent.page._browserbaseSessionId || 'local-playwright';
              } else {
                console.log('Page is closed, using default values');
                pageTitle = 'Browser Ready';
                currentUrl = 'about:blank';
                sessionId = 'local-playwright';
              }
            } catch (error) {
              console.log('Could not get page info:', error.message);
              // Use default values if page access fails
              pageTitle = 'Browser Ready';
              currentUrl = 'about:blank';
              sessionId = 'local-playwright';
            }
          }
          
          // Emit success status
          socket.emit('browser-initialized', {
            status: 'success',
            sessionId: sessionId,
            pageTitle: pageTitle,
            currentUrl: currentUrl,
            message: 'Browser window opened successfully'
          });
          
        } catch (error) {
          console.error('❌ Browser initialization failed:', error);
          socket.emit('browser-initialized', {
            status: 'error',
            message: `Failed to initialize browser: ${error.message}`
          });
        }
      });

      // Handle text commands (for testing)
      socket.on('text-command', async (data) => {
        try {
          const { command } = data;
          socket.emit('command-received', { command });
          await this.voiceAgent.processTranscript(command);
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
      });
    });
  }

  setupVoiceAgentEvents() {
    // Broadcast all voice agent events to connected clients
    this.voiceAgent.on('browser-initializing', (data) => {
      this.io.emit('browser-initializing', data);
    });

    this.voiceAgent.on('browser-initialized', (data) => {
      this.io.emit('browser-initialized', data);
    });

    this.voiceAgent.on('initialized', (data) => {
      // The browser-initialized event is handled separately above
      console.log('Voice Agent initialized:', data.message);
    });

    this.voiceAgent.on('listening-started', () => {
      this.io.emit('listening-status', {
        listening: true,
        message: 'Voice listening started'
      });
    });

    this.voiceAgent.on('listening-stopped', () => {
      this.io.emit('listening-status', {
        listening: false,
        message: 'Voice listening stopped'
      });
    });

    this.voiceAgent.on('transcript-progress', (data) => {
      this.io.emit('transcript-progress', data);
    });

    this.voiceAgent.on('task-started', (data) => {
      this.io.emit('task-started', data);
    });

    this.voiceAgent.on('task-completed', (data) => {
      this.io.emit('task-completed', data);
    });

    this.voiceAgent.on('task-failed', (data) => {
      this.io.emit('task-failed', data);
    });

    this.voiceAgent.on('agent-speaking', (data) => {
      this.io.emit('agent-speaking', data);
    });

    this.voiceAgent.on('error', (data) => {
      this.io.emit('error', data);
    });
  }

  async start() {
    try {
      console.log('🚀 Initializing Voice Enabled Browser Agent V2...');
      
      // Initialize the voice agent
      await this.voiceAgent.initialize();
      
      // Start the server
      this.server.listen(this.port, () => {
        console.log(`🚀 Voice Enabled Browser Agent V2 server running on port ${this.port}`);
        console.log(`🌐 Frontend available at: http://localhost:${this.port}`);
        console.log(`📊 Health check: http://localhost:${this.port}/health`);
      });

    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }

  async shutdown() {
    try {
      console.log('🛑 Shutting down Voice Enabled Browser Agent V2...');
      
      await this.voiceAgent.shutdown();
      
      this.server.close(() => {
        console.log('✅ Shutdown complete');
        process.exit(0);
      });

    } catch (error) {
      console.error('❌ Shutdown error:', error);
      process.exit(1);
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await agent.shutdown();
});

process.on('SIGTERM', async () => {
  await agent.shutdown();
});

const agent = new VoiceEnabledBrowserAgentV2();
agent.start();
