import { EventEmitter } from 'events';
import { initializeBrowser, closeBrowserSession, endBrowserbaseSession } from '../browser/bb-exec.js';
import { ComputerUseAgentV2 } from './ComputerUseAgentV2.js';
import SpeechToText from '../speech/SpeechToText.js';
import { AudioCapture } from '../audio/AudioCapture.js';

export class VoiceAgentV2 extends EventEmitter {
  constructor() {
    super();
    
    console.log('🎙️ Initializing Voice Agent V2...');

    this.speechToText = new SpeechToText({
      model: 'nova-2',
      language: 'en-US',
      smartFormat: true,
      interimResults: true
    });

    this.audioCapture = new AudioCapture({
      sampleRate: parseInt(process.env.AUDIO_SAMPLE_RATE) || 16000,
      channels: parseInt(process.env.AUDIO_CHANNELS) || 1,
      bitDepth: parseInt(process.env.AUDIO_BIT_DEPTH) || 16
    });

    // Fix EventEmitter memory leak warning
    this.speechToText.setMaxListeners(50);
    this.setMaxListeners(50);

    this.page = null;
    this.agent = null;
    this.isListening = false;
    this.isProcessing = false;

    this.setupEventHandlers();
  }

  async initialize() {
    try {
      console.log('🌐 Initializing browser...');
      this.emit('browser-initializing', { message: 'Starting browser session...' });
      
      this.page = await initializeBrowser();
      this.emit('browser-initializing', { message: 'Browser connected, setting up agent...' });
      
      this.agent = new ComputerUseAgentV2(this.page);
      
      console.log('✅ Voice Agent V2 initialized');
      
      // Store the session ID (local or Browserbase)
      const sessionId = this.page?._browserbaseSessionId || 'local-playwright';
      
      // Emit both events for compatibility with real session ID
      this.emit('browser-initialized', {
        status: 'success',
        sessionId: sessionId,
        pageTitle: 'Agent Ready',
        message: 'Voice Agent V2 ready for commands'
      });
      
      this.emit('initialized', {
        sessionId: 'agent-v2',
        pageTitle: 'Agent Ready',
        message: 'Voice Agent V2 ready for commands'
      });
      
    } catch (error) {
      console.error('❌ Initialization failed:', error);
      this.emit('error', { message: 'Failed to initialize agent' });
      throw error;
    }
  }

  async startListening() {
    if (this.isListening || this.isProcessing) {
      console.log('⚠️ Already active');
      return;
    }

    try {
      this.isListening = true;
      
      try {
        this.audioCapture.startCapture();
        console.log('✅ Audio capture started');
      } catch (audioError) {
        console.log('⚠️ Audio capture not available, continuing in text mode');
      }
      
      try {
        // Initialize speech-to-text connection
        await this.speechToText.startLiveTranscription(
          (data) => {
            if (data.is_final && data.channel.alternatives[0].transcript.trim()) {
              this.processTranscript(data.channel.alternatives[0].transcript);
            }
          },
          (error) => {
            console.error('❌ Speech-to-text error:', error);
          }
        );
        console.log('✅ Speech-to-text started');
      } catch (sttError) {
        console.log('⚠️ Speech-to-text not available, continuing');
      }
      
      console.log('🎤 Voice listening started');
      this.emit('listening-started');
      
      // Greet user immediately
      this.emit('agent-speaking', {
        message: "👋 I'm ready! Try clicking the microphone or type a command.",
        type: 'greeting'
      });

    } catch (error) {
      this.isListening = false;
      console.error('❌ Failed to start listening:', error);
      this.emit('error', { message: 'Voice listening failed' });
    }
  }

  async stopListening() {
    if (!this.isListening) {
      return;
    }

    try {
      this.isListening = false;
      this.audioCapture.stopCapture();
      
      // Close speech-to-text connection
      if (this.speechToText && typeof this.speechToText.closeConnection === 'function') {
        await this.speechToText.closeConnection();
        console.log('✅ Speech-to-text connection closed');
      } else {
        console.log('⚠️ Speech-to-text close method not available');
      }
      
      console.log('🔇 Voice listening stopped');
      this.emit('listening-stopped');

    } catch (error) {
      console.error('❌ Error stopping listening:', error);
    }
  }

  async processTranscript(transcript) {
    if (this.isProcessing || !transcript?.trim()) {
      console.log('⏳ Already processing or empty transcript');
      return;
    }

    try {
      this.isProcessing = true;
      
      console.log(`📝 Processing: "${transcript}"`);
      
      // Immediate acknowledgment
      this.emit('agent-speaking', {
        message: `Got it! "${transcript}" - Let me work on that for you...`,
        type: 'acknowledgment'
      });

      this.emit('task-started', {
        goal: transcript,
        message: 'Starting agent execution...'
      });

      if (!this.agent) {
        throw new Error('Agent not initialized');
      }

      const result = await this.agent.runAgent(transcript);
      
      console.log(`✅ Task completed: ${result}`);
      
      this.emit('task-completed', {
        goal: transcript,
        result: result,
        message: 'Task completed successfully!'
      });

      this.emit('agent-speaking', {
        message: `✅ Done! ${result}`,
        type: 'completion'
      });

      // Resume listening after a brief pause
      setTimeout(() => {
        if (!this.isListening) {
          this.startListening();
        }
      }, 2000);

    } catch (error) {
      console.error('❌ Task failed:', error);
      
      this.emit('task-failed', {
        goal: transcript,
        error: error.message,
        message: `Sorry, I encountered an error: ${error.message}`
      });

      this.emit('agent-speaking', {
        message: `❌ Sorry, I had trouble with "${transcript}". ${error.message}`,
        type: 'error'
      });

      // Resume listening on error too
      setTimeout(() => {
        if (!this.isListening) {
          this.startListening();
        }
      }, 3000);

    } finally {
      this.isProcessing = false;
    }
  }

  setupEventHandlers() {
    // Speech-to-text events
    this.speechToText.on('transcript', (data) => {
      if (!this.isProcessing && data.isFinal && data.transcript.trim()) {
        this.processTranscript(data.transcript);
      }
    });

    this.speechToText.on('transcript-progress', (data) => {
      // Only emit meaningful partial transcripts
      if (data.transcript.length >= 5 && data.transcript.split(' ').length >= 2) {
        this.emit('transcript-progress', {
          transcript: data.transcript,
          isFinal: false
        });
      }
    });

    // Audio events (disabled for V2 to avoid sendAudio errors)
    this.audioCapture.on('audio-data', (audioData) => {
      // Skip audio processing for V2 - will implement web audio later
    });

    this.audioCapture.on('error', (error) => {
      console.error('❌ Audio capture error:', error);
      this.emit('error', { message: 'Audio capture failed' });
    });
  }

  // Handle audio data from frontend Socket.IO
  handleFrontendAudio(audioData) {
    try {
      if (this.speechToText && this.speechToText.sendAudio) {
        // Convert base64 to buffer and send to Deepgram
        const buffer = Buffer.from(audioData, 'base64');
        this.speechToText.sendAudio(buffer);
        console.log('🎤 Audio sent to Deepgram');
      }
    } catch (error) {
      console.error('❌ Error processing frontend audio:', error.message);
    }

    // Speech-to-text errors
    this.speechToText.on('error', (error) => {
      console.error('❌ Speech-to-text error:', error);
      this.emit('error', { message: 'Speech recognition failed' });
    });
  }

  async shutdown() {
    try {
      if (this.isListening) {
        await this.stopListening();
      }
      
      if (this.page) {
        // Clean up Browserbase session properly
        await closeBrowserSession();
        
        // Clean up session in Browserbase dashboard if it exists
        if (this.page._browserbaseSessionId) {
          await endBrowserbaseSession(this.page._browserbaseSessionId);
        }
      }
      
      console.log('✅ Voice Agent V2 shut down');
      
    } catch (error) {
      console.error('❌ Shutdown error:', error);
    }
  }

  // Status for frontend
  getStatus() {
    return {
      isListening: this.isListening,
      isProcessing: this.isProcessing,
      hasAgent: !!this.agent,
      hasPage: !!this.page
    };
  }
}