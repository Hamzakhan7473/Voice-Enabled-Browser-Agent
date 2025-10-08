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
import VoiceOperator from './core/VoiceOperator.js';
import ContextManager from './context/ContextManager.js';
import FeedbackSystem from './feedback/FeedbackSystem.js';
import ErrorHandler from './utils/ErrorHandler.js';
import ExportSystem from './utils/ExportSystem.js';
import TaskTracker from './core/TaskTracker.js';
import UserConfirmationSystem from './core/UserConfirmationSystem.js';

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
        
        this.port = process.env.PORT || 3001;
        this.isInitialized = false;
        
        // Initialize components
        this.audioCapture = null;
        this.speechToText = null;
        this.intentParser = null;
        this.browserController = null;
        this.commandExecutor = null;
        this.voiceOperator = null;
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
                timeout: parseInt(process.env.BROWSER_TIMEOUT) || 15000,
                headless: false, // Always non-headless for live view
                viewport: {
                    width: parseInt(process.env.BROWSER_VIEWPORT_WIDTH) || 1920,
                    height: parseInt(process.env.BROWSER_VIEWPORT_HEIGHT) || 1080
                }
            });

            this.commandExecutor = new CommandExecutor({
                browserController: this.browserController,
                maxRetries: parseInt(process.env.MAX_RETRY_ATTEMPTS) || 3
            });

            // Initialize OpenAI Operator-style Voice Interface
            this.voiceOperator = new VoiceOperator({
                browserController: this.browserController
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

            this.taskTracker = new TaskTracker();
            this.confirmationSystem = new UserConfirmationSystem();

            // Initialize OpenAI Operator-style Voice Interface
            await this.voiceOperator.initialize();
            
            // Initialize Deepgram
            await this.audioCapture.initializeDeepgram(process.env.DEEPGRAM_API_KEY);
            
            // Set up event listeners
            this.setupEventListeners();
            this.setupAdvancedEventListeners();
            this.setupOperatorEventListeners();
            this.setupOperatorSocketHandlers();
            
            this.isInitialized = true;
            console.log('✅ Voice Enabled Browser Agent with OpenAI Operator architecture initialized successfully');
            
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
        this.app.use(express.static(path.join(__dirname, '../public')));
        
        // Serve index.html for root route
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/index.html'));
        });
        
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
                    
                    // Send Jarvis-style greeting
                    const greeting = this.generateGreeting();
                    socket.emit('agent-greeting', { 
                        message: greeting.message,
                        audio: greeting.audio,
                        timestamp: Date.now() 
                    });
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

            // Handle browser-based audio data streaming
            socket.on('audio-data', async (data) => {
                try {
                    if (!this.isListening) {
                        console.log('⚠️ Received audio data but not listening, ignoring');
                        return;
                    }
                    
                    // Decode base64 audio data
                    const audioBuffer = Buffer.from(data.audio, 'base64');
                    
                    // Send to Deepgram for live transcription
                    if (this.audioCapture?.liveConnection) {
                        this.audioCapture.liveConnection.send(audioBuffer);
                    }
                } catch (error) {
                    console.error('❌ Error processing audio data:', error);
                    socket.emit('error', { message: error.message });
                }
            });

            socket.on('confirmation-response', async (data) => {
                try {
                    if (this.currentConfirmation) {
                        this.currentConfirmation.resolve(data.confirmed);
                        this.currentConfirmation = null;
                    }
                } catch (error) {
                    socket.emit('error', { message: error.message });
                }
            });

            // Handle clarification responses
            socket.on('clarification-response', async (data) => {
                try {
                    const { taskId, stepNumber, answer } = data;
                    this.confirmationSystem.provideClarification(taskId, stepNumber, answer);
                } catch (error) {
                    console.error('❌ Error handling clarification:', error);
                    socket.emit('error', { message: error.message });
                }
            });

            // Get task status
            socket.on('get-task-status', () => {
                const activeTasks = this.taskTracker.getActiveTasks();
                const currentTask = this.taskTracker.getCurrentTask();
                const stats = this.taskTracker.getTaskStats();
                
                socket.emit('task-status', {
                    activeTasks,
                    currentTask,
                    stats
                });
            });

            // Get confirmation stats
            socket.on('get-confirmation-stats', () => {
                const stats = this.confirmationSystem.getConfirmationStats();
                const pending = this.confirmationSystem.getPendingConfirmations();
                
                socket.emit('confirmation-stats', {
                    stats,
                    pending
                });
            });

            socket.on('initialize-browser', async () => {
                try {
                    console.log('🚀 Creating browser session...');
                    
                    // Wait for browser controller to be ready
                    if (!this.browserController) {
                        throw new Error('Browser controller not initialized');
                    }
                    
                    // Check if already initializing
                    if (this.browserController.isInitializing) {
                        console.log('⏳ Browser initialization already in progress...');
                        socket.emit('browser-status', { status: 'initializing' });
                        return;
                    }
                    
                    const result = await this.browserController.createSession();
                    const sessionId = result.sessionId || result;
                    
                    socket.emit('browser-initialized', { 
                        sessionId: sessionId, 
                        timestamp: Date.now(),
                        status: 'success' 
                    });
                    
                } catch (error) {
                    console.error('❌ Failed to create session:', error);
                    socket.emit('browser-error', { 
                        error: error.message,
                        sessionId: null,
                        status: 'error' 
                    });
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
        
        // Live screenshot streaming
        this.browserController.on('live-screenshot', (data) => {
            this.io.emit('live-screenshot', data);
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

    setupAdvancedEventListeners() {
        // Task tracker events
        this.taskTracker.on('task-started', (task) => {
            this.io.emit('task-started', task);
        });

        this.taskTracker.on('step-started', (data) => {
            this.io.emit('step-started', data);
        });

        this.taskTracker.on('step-completed', (data) => {
            this.io.emit('step-completed', data);
        });

        this.taskTracker.on('step-failed', (data) => {
            this.io.emit('step-failed', data);
        });

        this.taskTracker.on('task-completed', (task) => {
            this.io.emit('task-completed', task);
        });

        this.taskTracker.on('task-failed', (task) => {
            this.io.emit('task-failed', task);
        });

        this.taskTracker.on('screenshot-added', (data) => {
            this.io.emit('task-screenshot', data);
        });

        // Confirmation system events
        this.confirmationSystem.on('confirmation-requested', (confirmation) => {
            this.io.emit('confirmation-requested', confirmation);
        });

        this.confirmationSystem.on('confirmation-provided', (result) => {
            this.io.emit('confirmation-provided', result);
        });

        this.confirmationSystem.on('clarification-needed', (clarification) => {
            this.io.emit('clarification-needed', clarification);
        });

        this.confirmationSystem.on('clarification-provided', (clarification) => {
            this.io.emit('clarification-provided', clarification);
        });
    }

    /**
     * Generate Jarvis-style greeting
     */
    generateGreeting() {
        const greetings = [
            "Hello! I'm your voice-enabled browser assistant. How may I help you today?",
            "Good day! I'm ready to assist you with browser automation. What would you like me to do?",
            "Hello there! I'm your AI browser agent. Please tell me what you'd like me to help you with.",
            "Hi! I'm here to help you navigate and automate your browser. What can I do for you?",
            "Greetings! I'm your voice-controlled browser assistant. How can I assist you today?",
            "Hello! I'm ready to help you with browser tasks. What would you like me to do?",
            "Good to see you! I'm your AI browser agent. Please let me know what you need help with.",
            "Hi there! I'm here to automate your browser tasks. What can I help you with today?"
        ];
        
        const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
        
        return {
            message: randomGreeting,
            audio: null, // Could be enhanced with TTS audio file
            type: 'greeting'
        };
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
            
            // Initialize Deepgram if not already done
            if (!this.audioCapture.deepgramClient) {
                await this.audioCapture.initializeDeepgram(process.env.DEEPGRAM_API_KEY);
            }
            
            // Start live transcription for browser-based audio
            if (!this.audioCapture.liveConnection) {
                await this.audioCapture.startLiveTranscription();
            }
            
            console.log('🎙️ Started listening for voice commands (browser audio mode)');
        } catch (error) {
            this.isListening = false;
            console.error('❌ Failed to start listening:', error);
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
            
            // INSTANT VOICE RESPONSE - like OpenAI operator
            this.io.emit('agent-speaking', {
                message: "⚡ I'm on it! Let me handle that for you...",
                type: 'immediate_response'
            });

            // Get current context
            const context = this.contextManager.getContext();
            const browserStatus = this.browserController.getStatus();

            // Parse intent with enhanced context
            const intent = await this.intentParser.parseIntent(transcript, {
                ...context,
                currentUrl: browserStatus.currentUrl,
                pageTitle: browserStatus.pageTitle,
                recentActions: context.recentActions || []
            });
            
            console.log('🎯 Parsed intent:', intent);

            // Check if confirmation is required
            if (this.confirmationSystem.requiresConfirmation(intent, context)) {
                const confirmation = await this.confirmationSystem.requestConfirmation(intent, context);
                
                // Wait for user confirmation
                try {
                    const confirmationResult = await this.confirmationSystem.waitForConfirmation(confirmation.id, 30000);
                    
                    if (!confirmationResult.confirmed) {
                        console.log('👤 User rejected the action');
                        this.io.emit('action-rejected', { intent, reason: confirmationResult.userResponse });
                        return;
                    }
                } catch (timeoutError) {
                    console.log('⏰ Confirmation timeout, proceeding with caution');
                }
            }

            // Start task tracking for complex tasks
            let taskId = null;
            if (intent.steps && intent.steps.length > 1) {
                taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                this.taskTracker.startTask(taskId, {
                    description: intent.originalText,
                    intent,
                    steps: intent.steps
                });
            }

            // Update context
            this.contextManager.addInteraction({
                transcript,
                intent,
                timestamp: Date.now()
            });

            // Execute command with task tracking
            let result;
            if (taskId && intent.steps) {
                // Execute multi-step task
                result = await this.executeMultiStepTask(taskId, intent);
            } else {
                // Execute single command
                result = await this.commandExecutor.executeCommand(intent);
            }
            
            console.log('✅ Command executed:', result);

            // Complete task if it was tracked
            if (taskId) {
                this.taskTracker.completeTask(taskId, result);
            }

            // Generate feedback
            const feedback = await this.feedbackSystem.generateFeedback(result);
            this.io.emit('feedback-generated', feedback);

        } catch (error) {
            console.error('❌ Error processing transcript:', error);
            this.io.emit('error', { message: error.message });
            
            // Fail task if it was tracked
            if (this.taskTracker.getCurrentTask()) {
                this.taskTracker.failTask(this.taskTracker.getCurrentTask().id, error);
            }
        } finally {
            this.isProcessing = false;
        }
    }

    async executeMultiStepTask(taskId, intent) {
        const results = [];
        
        for (let i = 0; i < intent.steps.steps.length; i++) {
            const step = intent.steps.steps[i];
            
            try {
                // Update task progress
                this.taskTracker.updateTaskProgress(taskId, step.step_number, {
                    description: step.description,
                    action: step.action
                });

                // Execute step
                const stepIntent = {
                    intent: step.action,
                    parameters: {
                        selector: step.selector,
                        value: step.value,
                        ...step.parameters
                    },
                    originalText: step.description
                };

                const stepResult = await this.commandExecutor.executeCommand(stepIntent);
                
                // Complete step
                this.taskTracker.completeStep(taskId, step.step_number, stepResult);
                results.push(stepResult);

                // Add screenshot if available
                if (this.browserController.page) {
                    const screenshot = await this.browserController.page.screenshot({ type: 'png' });
                    this.taskTracker.addScreenshot(taskId, {
                        image: screenshot.toString('base64'),
                        stepNumber: step.step_number
                    });
                }

                // Check if confirmation is required for this step
                if (step.requires_confirmation) {
                    const confirmation = await this.confirmationSystem.requestConfirmation(stepIntent, {
                        currentUrl: this.browserController.getStatus().currentUrl
                    });
                    
                    const confirmationResult = await this.confirmationSystem.waitForConfirmation(confirmation.id, 30000);
                    if (!confirmationResult.confirmed) {
                        throw new Error(`Step ${step.step_number} rejected by user`);
                    }
                }

                // Wait between steps for human-like behavior
                await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

            } catch (error) {
                this.taskTracker.failStep(taskId, step.step_number, error);
                throw error;
            }
        }

        return { success: true, steps: results, totalSteps: intent.steps.steps.length };
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
            
            // Browser will be initialized on first command
            
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
     * Setup OpenAI Operator-style event handlers
     */
    setupOperatorEventListeners() {
        // VoiceOperator events
        this.voiceOperator.on('action-progress', (data) => {
            this.io.emit('action-progress', {
                step: data.step,
                action: data.action,
                screenshot: data.screenshot,
                message: data.message
            });
        });

        this.voiceOperator.on('task-started', (data) => {
            this.io.emit('task-started', data);
            console.log(`🎯 OpenAI Operator task started: ${data.goal}`);
        });

        this.voiceOperator.on('task-completed', (data) => {
            this.io.emit('task-completed', data);
            console.log(`✅ OpenAI Operator task completed: ${data.goal}`);
        });

        this.voiceOperator.on('task-failed', (data) => {
            this.io.emit('task-failed', data);
            console.error(`❌ OpenAI Operator task failed: ${data.goal}`);
        });

        this.voiceOperator.on('agent-speaking', (data) => {
            this.io.emit('agent-speaking', data);
            this.io.emit('feedback-generated', {
                type: 'agent_response',
                message: data.message,
                timestamp: new Date().toISOString()
            });
        });

        this.voiceOperator.on('transcript-progress', (data) => {
            this.io.emit('transcript-progress', data);
        });

        this.voiceOperator.on('browser-initialized', (data) => {
            this.io.emit('browser-initialized', data);
        });

        this.voiceOperator.on('browser-error', (data) => {
            this.io.emit('browser-error', data);
        });

        this.voiceOperator.on('browser-update', (data) => {
            this.io.emit('live-screenshot', data);
        });

        this.voiceOperator.on('error', (data) => {
            this.io.emit('error', data);
        });
    }

    /**
     * Set up Socket.IO handlers for OpenAI Operator mode
     */
    setupOperatorSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log('🔌 Client connected:', socket.id);
            
            // Initialize browser (both traditional and Operator modes)
            socket.on('initialize-browser', async () => {
                try {
                    console.log('🌐 Initializing browser session...');
                    
                    // Initialize traditional browser
                    await this.browserController.createSession();
                    
                    // Also initialize Operator browser
                    const operatorReady = await this.voiceOperator.initializeBrowser();
                    
                    const browserStatus = this.browserController.getStatus();
                    
                    socket.emit('browser-initialized', {
                        status: 'success',
                        sessionId: browserStatus.sessionId,
                        currentUrl: browserStatus.currentUrl,
                        pageTitle: browserStatus.pageTitle,
                        message: 'Browser initialized - both traditional and Operator modes ready!'
                    });
                    
                    console.log(`✅ Browser session initialized: ${browserStatus.sessionId}`);
                    
                } catch (error) {
                    console.error('❌ Failed to initialize browser session:', error);
                    socket.emit('browser-error', {
                        status: 'error',
                        error: error.message,
                        message: 'Browser initialization failed'
                    });
                }
            });

            // Initialize OpenAI Operator mode (separate handler)
            socket.on('initialize-operator', async () => {
                try {
                    console.log('🤖 Initializing OpenAI Operator mode...');
                    
                    // Initialize browser for Operator
                    const browserReady = await this.voiceOperator.initializeBrowser();
                    
                    if (browserReady) {
                        socket.emit('operator-ready', {
                            status: 'success',
                            message: 'OpenAI Operator mode ready - Speak your commands!'
                        });
                        console.log('✅ OpenAI Operator mode initialized successfully');
                    } else {
                        socket.emit('operator-error', {
                            status: 'error',
                            message: 'Failed to initialize OpenAI Operator mode'
                        });
                    }
                    
                } catch (error) {
                    console.error('❌ Failed to initialize Operator mode:', error);
                    socket.emit('operator-error', {
                        status: 'error',
                        message: `Operator initialization failed: ${error.message}`
                    });
                }
            });
            
            // Start Operator voice listening
            socket.on('start-operator-listening', async () => {
                try {
                    this.voiceOperator.startListening();
                    socket.emit('operator-listening', {
                        status: 'success',
                        message: '🎙️ OpenAI Operator is now listening for voice commands'
                    });
                } catch (error) {
                    socket.emit('operator-error', {
                        status: 'error',
                        message: `Failed to start Operator listening: ${error.message}`
                    });
                }
            });
            
            // Stop Operator voice listening
            socket.on('stop-operator-listening', () => {
                this.voiceOperator.stopListening();
                socket.emit('operator-stopped', {
                    status: 'success',
                    message: '🔇 OpenAI Operator stopped listening'
                });
            });
            
            // Send voice command directly to Operator
            socket.on('operator-voice-command', async (data) => {
                try {
                    const { command } = data;
                    if (!command || command.trim().length === 0) {
                        socket.emit('operator-error', {
                            status: 'error',
                            message: 'Voice command is required'
                        });
                        return;
                    }
                    
                    console.log(`🎯 Operator received command: "${command}"`);
                    
                    // Start listening indicator
                    socket.emit('listening-stopped');
                    
                    // Execute via Operator
                    await this.voiceOperator.executeGoal(command);
                    
                } catch (error) {
                    console.error('❌ Operator command execution failed:', error);
                    socket.emit('operator-error', {
                        status: 'error',
                        message: `Command execution failed: ${error.message}`
                    });
                }
            });
            
            // Traditional voice command handler (for backward compatibility)
            socket.on('voice-command', async (data) => {
                try {
                    const { command } = data;
                    if (!command || command.trim().length === 0) {
                        socket.emit('error', { message: 'Voice command is required' });
                        return;
                    }
                    
                    console.log(`🎯 Traditional command received: "${command}"`);
                    
                    // Also try Operator mode for complex commands
                    try {
                        await this.voiceOperator.executeGoal(command);
                    } catch (operatorError) {
                        console.warn('⚠️ Operator mode failed, falling back to traditional:', operatorError.message);
                        
                        // Fallback to traditional processing
                        await this.processTranscript(command);
                    }
                    
                } catch (error) {
                    console.error('❌ Voice command execution failed:', error);
                    socket.emit('error', { message: `Command execution failed: ${error.message}` });
                }
            });

            socket.on('disconnect', () => {
                console.log('🔌 Client disconnected:', socket.id);
                this.voiceOperator.stopListening();
            });
        });
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