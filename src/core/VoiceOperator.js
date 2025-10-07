import { EventEmitter } from 'events';
import ComputerUseAgent from './ComputerUseAgent.js';
import SpeechToText from '../speech/SpeechToText.js';
import { AudioCapture } from '../audio/AudioCapture.js';

/**
 * Voice-controlled OpenAI Operator interface
 * Mimics the real Operator's voice-to-screen architecture
 */
class VoiceOperator extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.browserController = options.browserController;
        this.isListening = false;
        this.isProcessing = false;
        
        // Initialize OpenAI Computer-Use Agent
        this.computerAgent = new ComputerUseAgent({
            browserController: this.browserController,
            model: 'gpt-4o'
        });
        
        // Initialize voice components
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
        
        // Current goal state
        this.currentGoal = null;
        this.isAgentActive = false;
        
        this.setupEventHandlers();
    }

    /**
     * Initialize voice components
     */
    async initialize() {
        try {
            console.log('🎙️ Initializing Voice Operator...');
            
            // Initialize Deepgram
            await this.audioCapture.initializeDeepgram(process.env.DEEPGRAM_API_KEY);
            
            // Set up speech recognition
            this.speechToText.on('transcript', this.handleTranscript.bind(this));
            this.speechToText.on('finalTranscript', this.handleFinalTranscript.bind(this));
            
            console.log('✅ Voice Operator initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize Voice Operator:', error);
            throw error;
        }
    }

    /**
     * Set up event handlers
     */
    setupEventHandlers() {
        // Set up computer agent events
        this.computerAgent.on('action-observed', (data) => {
            this.emit('action-progress', {
                step: data.step,
                action: data.action,
                screenshot: data.screenshot,
                message: `Executing: ${data.action.action}`
            });
        });
        
        // Set up browser events for live screenshots
        this.browserController.on('live-screenshot', (data) => {
            this.emit('browser-update', data);
        });
    }

    /**
     * Start listening for voice commands
     */
    startListening() {
        if (this.isListening) {
            console.log('⚠️ Already listening for voice commands');
            return;
        }
        
        try {
            this.isListening = true;
            this.stopAgentExecution();
            
            console.log('🎤 Starting OpenAI Operator-style voice listening...');
            
            // Initialize audio capture
            this.audioCapture.startCapture();
            this.speechToText.startTranscription();
            
            // Send immediate feedback like Operator
            this.emit('agent-speaking', {
                message: "🎧 I'm listening... What would you like me to help you with?",
                type: 'greeting'
            });
            
        } catch (error) {
            this.isListening = false;
            console.error('❌ Failed to start voice listening:', error);
            this.emit('error', { message: 'Voice listening failed to start' });
        }
    }

    /**
     * Stop listening for voice commands
     */
    stopListening() {
        if (!this.isListening) {
            return;
        }
        
        try {
            this.isListening = false;
            
            this.audioCapture.stopCapture();
            this.speechToText.stopTranscription();
            
            console.log('🔇 Stopped OpenAI Operator-style voice listening');
            
        } catch (error) {
            console.error('❌ Error stopping voice listening:', error);
        }
    }

    /**
     * Handle interim transcripts (like Operator's real-time feedback)
     * Optimized to reduce noise and only emit meaningful transcripts
     */
    handleTranscript(transcript) {
        if (!transcript || transcript.length < 5) return;
        
        // Only emit meaningful partial transcripts (not single words or fragments)
        if (transcript.split(' ').length >= 2) {
            this.emit('transcript-progress', {
                transcript: transcript,
                isFinal: false
            });
        }
    }

    /**
     * Handle final transcripts - start Agent execution
     */
    async handleFinalTranscript(transcript) {
        try {
            if (!transcript || transcript.length < 3) return;
            
            console.log(`🎯 Final command: "${transcript}"`);
            
            // Stop listening while processing
            this.stopListening();
            
            // Emit immediate feedback like Operator
            this.emit('agent-speaking', {
                message: `⚡ Got it! "${transcript}" - Let me work on that for you...`,
                type: 'acknowledgment'
            });
            
            // Start computer-use agent execution
            await this.executeGoal(transcript);
            
        } catch (error) {
            console.error('❌ Error processing command:', error);
            this.emit('error', { message: 'Failed to process voice command' });
            
            // Resume listening
            this.startListening();
        }
    }

    /**
     * Execute a goal using the computer-use agent
     */
    async executeGoal(goal) {
        try {
            // Create queue system instead of blocking
            if (this.isProcessing) {
                console.log(`⏳ Goal queued: "${goal}" (current: "${this.currentGoal}")`);
                this.commandQueue = this.commandQueue || [];
                this.commandQueue.push(goal);
                return;
            }
            
            this.isProcessing = true;
            this.currentGoal = goal;
            this.isAgentActive = true;
            
            // Emit task started
            this.emit('task-started', {
                goal: goal,
                message: 'Starting computer-use agent execution...'
            });
            
            console.log('🤖 Starting OpenAI Operator-style execution...');
            
            // Execute using computer-use agent
            const result = await this.computerAgent.executeGoal(goal);
            
            // Emit completion
            this.emit('task-completed', {
                goal: goal,
                result: result,
                message: result.message || 'Task completed successfully!'
            });
            
            // Emit final agent feedback
            this.emit('agent-speaking', {
                message: `✅ Done! I've completed: "${goal}"`,
                type: 'completion'
            });
            
            console.log('🎉 OpenAI Operator-style execution completed:', result);
            
        } catch (error) {
            console.error('❌ Goal execution failed:', error);
            
            this.emit('task-failed', {
                goal: this.currentGoal,
                error: error.message,
                message: `Sorry, I encountered an error: ${error.message}`
            });
            
            this.emit('agent-speaking', {
                message: `❌ Sorry, I had trouble with: "${goal}". ${error.message}`,
                type: 'error'
            });
            
        } finally {
            this.isProcessing = false;
            this.currentGoal = null;
            this.isAgentActive = false;
            
            // Resume listening after completion
            setTimeout(() => {
                this.startListening();
            }, 2000);
        }
    }

    /**
     * Stop current agent execution
     */
    async stopAgentExecution() {
        if (this.isAgentActive) {
            this.isAgentActive = false;
            this.isProcessing = false;
            
            // Cancel any ongoing computer agent operations
            // This would require implementing cancellation in ComputerUseAgent
            console.log('🛑 Stopping agent execution...');
        }
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            isListening: this.isListening,
            isProcessing: this.isProcessing,
            isAgentActive: this.isAgentActive,
            currentGoal: this.currentGoal,
            agentState: this.computerAgent.getState()
        };
    }

    /**
     * Initialize browser session for Operator mode
     */
    async initializeBrowser() {
        try {
            if (!this.browserController.isConnected) {
                await this.browserController.createSession();
                
                // Emit successful initialization
                this.emit('browser-initialized', {
                    status: 'success',
                    sessionId: this.browserController.sessionId,
                    message: 'Browser ready for Operator-style control'
                });
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ Failed to initialize browser:', error);
            
            this.emit('browser-error', {
                status: 'error',
                error: error.message,
                message: 'Failed to initialize browser for Operator mode'
            });
            
            return false;
        }
    }

    /**
     * Cleanup
     */
    async cleanup() {
        try {
            this.stopListening();
            this.stopAgentExecution();
            
            console.log('✅ Voice Operator cleaned up');
            
        } catch (error) {
            console.error('❌ Error during Voice Operator cleanup:', error);
        }
    }
}

export default VoiceOperator;
