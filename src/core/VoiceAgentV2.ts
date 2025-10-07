import { EventEmitter } from 'events';
import { connectToBrowserbase } from '../browser/bb-exec.js';
import { ComputerUseAgentV2 } from './ComputerUseAgentV2.js';
import SpeechToText from '../speech/SpeechToText.js';
import { AudioCapture } from '../audio/AudioCapture.js';

export class VoiceAgentV2 extends EventEmitter {
  private speechToText: SpeechToText;
  private audioCapture: AudioCapture;
  private agent: ComputerUseAgentV2 | null = null;
  private page: any = null;
  private isListening = false;
  private isProcessing = false;

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

    this.setupEventHandlers();
  }

  async initialize(): Promise<void> {
    try {
      console.log('🌐 Connecting to browser...');
      this.page = await connectToBrowserbase();
      this.agent = new ComputerUseAgentV2(this.page);
      
      console.log('✅ Voice Agent V2 initialized');
      this.emit('initialized');
      
    } catch (error) {
      console.error('❌ Initialization failed:', error);
      this.emit('error', { message: 'Failed to initialize agent' });
      throw error;
    }
  }

  async startListening(): Promise<void> {
    if (this.isListening || this.isProcessing) {
      console.log('⚠️ Already active');
      return;
    }

    try {
      this.isListening = true;
      this.audioCapture.startCapture();
      this.speechToText.startTranscription();
      
      console.log('🎤 Voice listening started');
      this.emit('listening-started');
      
      // Greet user immediately
      this.emit('agent-speaking', {
        message: "👋 I'm ready! What would you like me to help you with?",
        type: 'greeting'
      });

    } catch (error) {
      this.isListening = false;
      console.error('❌ Failed to start listening:', error);
      this.emit('error', { message: 'Voice listening failed' });
    }
  }

  async stopListening(): Promise<void> {
    if (!this.isListening) {
      return;
    }

    try {
      this.isListening = false;
      this.audioCapture.stopCapture();
      this.speechToText.stopTranscription();
      
      console.log('🔇 Voice listening stopped');
      this.emit('listening-stopped');

    } catch (error) {
      console.error('❌ Error stopping listening:', error);
    }
  }

  async processTranscript(transcript: string): Promise<void> {
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

  private setupEventHandlers(): void {
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

    // Audio events
    this.audioCapture.on('audio-data', (audioData) => {
      this.speechToText.sendAudio(audioData);
    });

    this.audioCapture.on('error', (error) => {
      console.error('❌ Audio capture error:', error);
      this.emit('error', { message: 'Audio capture failed' });
    });

    // Speech-to-text errors
    this.speechToText.on('error', (error) => {
      console.error('❌ Speech-to-text error:', error);
      this.emit('error', { message: 'Speech recognition failed' });
    });
  }

  async shutdown(): Promise<void> {
    try {
      if (this.isListening) {
        await this.stopListening();
      }
      
      if (this.page) {
        await this.page.close();
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
