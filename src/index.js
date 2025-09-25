import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Import our custom modules
import { AudioCapture } from './audio/AudioCapture.js';
import SpeechToText from './speech/SpeechToText.js';
import IntentParser from './nlp/IntentParser.js';
import BrowserController from './browser/BrowserController.js';
import CommandExecutor from './core/CommandExecutor.js';
import ContextManager from './context/ContextManager.js';
import FeedbackSystem from './feedback/FeedbackSystem.js';
import ErrorHandler from './utils/ErrorHandler.js';
import ExportSystem from './utils/ExportSystem.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
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
        this.isInitialized = false;
        
        // Initialize components
        this.audioCapture = null;
        this.speechToText = null;
        this.intentParser = null;
        this.browserController = null;
        this.commandExecutor = null;
        this.contextManager = null;
        this.feedbackSystem = null;
        this.errorHandler = null;
        this.exportSystem = null;
        
        // Session state
        this.currentSession = null;
        this.isListening = false;
        this.isProcessing = false;
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketHandlers();
    }

    /**
     * Initialize all components
     */
    async initialize() {
        try {
            console.log('🚀 Initializing Voice Enabled Browser Agent...');
            
            // Initialize components
            this.audioCapture = new AudioCapture({
                sampleRate: parseInt(process.env.AUDIO_SAMPLE_RATE) || 16000,
                channels: parseInt(process.env.AUDIO_CHANNELS) || 1,
                bitDepth: parseInt(process.env.AUDIO_BIT_DEPTH) || 16
            });

            this.speechToText = new SpeechToText({
                model: 'nova-2',
                language: 'en-US',
                smartFormat: true,
                interimResults: true
            });

            this.intentParser = new IntentParser({
                model: 'gpt-4',
                maxTokens: 500,
                temperature: 0.1
            });

            this.browserController = new BrowserController({
                timeout: parseInt(process.env.BROWSER_TIMEOUT) || 30000,
                headless: process.env.BROWSER_HEADLESS === 'true',
                viewport: {
                    width: parseInt(process.env.BROWSER_VIEWPORT_WIDTH) || 1920,
                    height: parseInt(process.env.BROWSER_VIEWPORT_HEIGHT) || 1080
                }
            });

            this.commandExecutor = new CommandExecutor({
                browserController: this.browserController,
                maxRetries: parseInt(process.env.MAX_RETRY_ATTEMPTS) || 3
            });

            this.contextManager = new ContextManager({
                maxHistory: 50,
                sessionTimeout: parseInt(process.env.SESSION_TIMEOUT) || 300000
            });

            this.feedbackSystem = new FeedbackSystem({
                enableTTS: true,
                enableLogging: true
            });

            this.errorHandler = new ErrorHandler({
                maxRetries: parseInt(process.env.MAX_RETRY_ATTEMPTS) || 3,
                retryDelay: 1000
            });

            this.exportSystem = new ExportSystem({
                exportDirectory: process.env.EXPORT_DIRECTORY || './exports',
                sessionDirectory: process.env.SESSION_ARCHIVE_DIRECTORY || './sessions'
            });

            // Initialize Deepgram
            await this.audioCapture.initializeDeepgram(process.env.DEEPGRAM_API_KEY);
            
            // Set up event listeners
            this.setupEventListeners();
            
            this.isInitialized = true;
            console.log('✅ Voice Enabled Browser Agent initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize Voice Enabled Browser Agent:', error);
            throw error;
        }
    }

    /**
     * Set up middleware
     */
    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname, '../../public')));
        
        // CORS middleware
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            next();
        });
    }

    /**
     * Set up routes
     */
    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                components: {
                    audioCapture: !!this.audioCapture,
                    speechToText: !!this.speechToText,
                    intentParser: !!this.intentParser,
                    browserController: !!this.browserController,
                    commandExecutor: !!this.commandExecutor,
                    contextManager: !!this.contextManager,
                    feedbackSystem: !!this.feedbackSystem,
                    errorHandler: !!this.errorHandler,
                    exportSystem: !!this.exportSystem
                }
            });
        });

        // API endpoints
        this.app.get('/api/status', (req, res) => {
            res.json({
                isInitialized: this.isInitialized,
                isListening: this.isListening,
                isProcessing: this.isProcessing,
                currentSession: this.currentSession ? {
                    id: this.currentSession.id,
                    startTime: this.currentSession.startTime,
                    currentUrl: this.currentSession.currentUrl
                } : null
            });
        });

        this.app.post('/api/start-session', async (req, res) => {
            try {
                await this.startNewSession();
                res.json({ success: true, sessionId: this.currentSession.id });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.post('/api/stop-session', async (req, res) => {
            try {
                await this.stopCurrentSession();
                res.json({ success: true });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.post('/api/export-session', async (req, res) => {
            try {
                if (!this.currentSession) {
                    throw new Error('No active session to export');
                }
                const exportPath = await this.exportSystem.exportSession(this.currentSession);
                res.json({ success: true, exportPath });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });
    }

    /**
     * Set up Socket.IO handlers
     */
    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`🔌 Client connected: ${socket.id}`);

            socket.on('start-listening', async () => {
                try {
                    await this.startListening();
                    socket.emit('listening-started', { timestamp: Date.now() });
                } catch (error) {
                    socket.emit('error', { message: error.message });
                }
            });

            socket.on('stop-listening', async () => {
                try {
                    await this.stopListening();
                    socket.emit('listening-stopped', { timestamp: Date.now() });
                } catch (error) {
                    socket.emit('error', { message: error.message });
                }
            });

            socket.on('take-screenshot', async () => {
                try {
                    if (!this.browserController || !this.browserController.page) {
                        throw new Error('No active browser session');
                    }
                    const screenshotPath = await this.browserController.takeScreenshot();
                    socket.emit('screenshot-taken', { path: screenshotPath });
                } catch (error) {
                    socket.emit('error', { message: error.message });
                }
            });

            socket.on('extract-data', async () => {
                try {
                    if (!this.browserController || !this.browserController.page) {
                        throw new Error('No active browser session');
                    }
                    const extractedData = await this.browserController.extractPageData();
                    socket.emit('data-extracted', { data: extractedData });
                } catch (error) {
                    socket.emit('error', { message: error.message });
                }
            });

            socket.on('disconnect', () => {
                console.log(`🔌 Client disconnected: ${socket.id}`);
            });
        });
    }

    /**
     * Set up event listeners between components
     */
    setupEventListeners() {
        // Audio capture events
        this.audioCapture.on('transcript', async (transcriptData) => {
            this.io.emit('transcript-received', transcriptData);
            
            if (transcriptData.isFinal && transcriptData.confidence > 0.7) {
                await this.processTranscript(transcriptData.text);
            }
        });

        this.audioCapture.on('error', (error) => {
            console.error('Audio capture error:', error);
            this.io.emit('error', { message: error.message });
        });

        // Speech-to-text events
        this.speechToText.on('transcription-complete', (transcription) => {
            this.io.emit('transcription-complete', transcription);
        });

        // Browser controller events
        this.browserController.on('page-loaded', (data) => {
            this.io.emit('page-loaded', data);
        });

        this.browserController.on('action-completed', (data) => {
            this.io.emit('action-completed', data);
        });

        this.browserController.on('screenshot-taken', (data) => {
            this.io.emit('screenshot-taken', data);
        });

        // Command executor events
        this.commandExecutor.on('command-executed', (data) => {
            this.io.emit('command-executed', data);
        });

        this.commandExecutor.on('command-failed', (data) => {
            this.io.emit('command-failed', data);
        });

        // Context manager events
        this.contextManager.on('context-updated', (data) => {
            this.io.emit('context-updated', data);
        });

        // Feedback system events
        this.feedbackSystem.on('feedback-generated', (data) => {
            this.io.emit('feedback-generated', data);
        });
    }

    /**
     * Start listening for voice commands
     */
    async startListening() {
        if (this.isListening) {
            throw new Error('Already listening');
        }

        try {
            this.isListening = true;
            await this.audioCapture.startCapture();
            console.log('🎙️ Started listening for voice commands');
        } catch (error) {
            this.isListening = false;
            throw error;
        }
    }

    /**
     * Stop listening for voice commands
     */
    async stopListening() {
        if (!this.isListening) {
            return;
        }

        try {
            await this.audioCapture.stopCapture();
            this.isListening = false;
            console.log('🔇 Stopped listening for voice commands');
        } catch (error) {
            throw error;
        }
    }

    /**
     * Process transcript and execute commands
     */
    async processTranscript(transcript) {
        if (this.isProcessing) {
            console.log('⏳ Already processing a command, skipping...');
            return;
        }

        try {
            this.isProcessing = true;
            console.log(`📝 Processing transcript: "${transcript}"`);

            // Parse intent
            const intent = await this.intentParser.parseIntent(transcript, this.contextManager.getContext());
            console.log('🎯 Parsed intent:', intent);

            // Update context
            this.contextManager.addInteraction({
                transcript,
                intent,
                timestamp: Date.now()
            });

            // Execute command
            const result = await this.commandExecutor.executeCommand(intent);
            console.log('✅ Command executed:', result);

            // Generate feedback
            const feedback = await this.feedbackSystem.generateFeedback(result);
            this.io.emit('feedback-generated', feedback);

        } catch (error) {
            console.error('❌ Error processing transcript:', error);
            this.io.emit('error', { message: error.message });
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Start a new session
     */
    async startNewSession() {
        try {
            // Create browser session
            await this.browserController.createSession();
            
            // Create context session
            this.currentSession = this.contextManager.createSession();
            
            console.log(`🚀 Started new session: ${this.currentSession.id}`);
            this.io.emit('session-started', { sessionId: this.currentSession.id });
            
        } catch (error) {
            console.error('❌ Failed to start new session:', error);
            throw error;
        }
    }

    /**
     * Stop current session
     */
    async stopCurrentSession() {
        try {
            if (this.currentSession) {
                // Stop listening if active
                if (this.isListening) {
                    await this.stopListening();
                }

                // Close browser session
                await this.browserController.closeSession();

                // Archive session
                await this.exportSystem.archiveSession(this.currentSession);

                console.log(`🛑 Stopped session: ${this.currentSession.id}`);
                this.io.emit('session-stopped', { sessionId: this.currentSession.id });
                
                this.currentSession = null;
            }
        } catch (error) {
            console.error('❌ Failed to stop session:', error);
            throw error;
        }
    }

    /**
     * Start the server
     */
    async start() {
        try {
            await this.initialize();
            
            this.server.listen(this.port, () => {
                console.log(`🚀 Voice Enabled Browser Agent server running on port ${this.port}`);
                console.log(`🌐 Frontend available at: http://localhost:${this.port}`);
                console.log(`📊 Health check: http://localhost:${this.port}/health`);
            });
        } catch (error) {
            console.error('❌ Failed to start server:', error);
            process.exit(1);
        }
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        console.log('🛑 Shutting down Voice Enabled Browser Agent...');
        
        try {
            if (this.currentSession) {
                await this.stopCurrentSession();
            }
            
            if (this.audioCapture) {
                await this.audioCapture.cleanup();
            }
            
            if (this.browserController) {
                await this.browserController.closeSession();
            }
            
            this.server.close();
            console.log('✅ Shutdown complete');
        } catch (error) {
            console.error('❌ Error during shutdown:', error);
        }
    }
}

// Create and start the server
const agent = new VoiceEnabledBrowserAgent();

// Handle graceful shutdown
process.on('SIGINT', async () => {
    await agent.shutdown();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await agent.shutdown();
    process.exit(0);
});

// Start the server
agent.start().catch(console.error);