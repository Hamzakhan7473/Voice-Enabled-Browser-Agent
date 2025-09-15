import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import fs from 'fs-extra';
import path from 'path';

class SpeechToText {
  constructor(options = {}) {
    this.apiKey = process.env.DEEPGRAM_API_KEY;
    if (!this.apiKey) {
      throw new Error('DEEPGRAM_API_KEY environment variable is required');
    }

    this.client = createClient(this.apiKey);
    this.connection = null;
    this.isConnected = false;
    this.options = {
      model: options.model || 'nova-2',
      language: options.language || 'en-US',
      smart_format: options.smartFormat !== false,
      interim_results: options.interimResults !== false,
      endpointing: options.endpointing !== false,
      vad_events: options.vadEvents !== false,
      ...options
    };
  }

  async startLiveTranscription(onTranscript, onError) {
    try {
      this.connection = this.client.listen.live(this.options);

      this.connection.on(LiveTranscriptionEvents.Open, () => {
        this.isConnected = true;
        console.log('🎙️ Deepgram connection opened');
      });

      this.connection.on(LiveTranscriptionEvents.Close, () => {
        this.isConnected = false;
        console.log('🎙️ Deepgram connection closed');
      });

      this.connection.on(LiveTranscriptionEvents.Transcript, (data) => {
        if (onTranscript) {
          onTranscript(data);
        }
      });

      this.connection.on(LiveTranscriptionEvents.Metadata, (data) => {
        console.log('📊 Deepgram metadata:', data);
      });

      this.connection.on(LiveTranscriptionEvents.Error, (error) => {
        console.error('❌ Deepgram error:', error);
        if (onError) {
          onError(error);
        }
      });

      this.connection.on(LiveTranscriptionEvents.Warning, (warning) => {
        console.warn('⚠️ Deepgram warning:', warning);
      });

      return this.connection;
    } catch (error) {
      console.error('Failed to start live transcription:', error);
      throw error;
    }
  }

  async transcribeAudioFile(audioFilePath) {
    try {
      if (!await fs.pathExists(audioFilePath)) {
        throw new Error(`Audio file not found: ${audioFilePath}`);
      }

      const audioBuffer = await fs.readFile(audioFilePath);
      
      const response = await this.client.listen.prerecorded.transcribeFile(
        audioBuffer,
        {
          model: this.options.model,
          language: this.options.language,
          smart_format: this.options.smart_format,
          punctuate: true,
          diarize: false,
          utterances: true,
          paragraphs: true
        }
      );

      return this.processTranscriptionResponse(response);
    } catch (error) {
      console.error('Failed to transcribe audio file:', error);
      throw error;
    }
  }

  async transcribeAudioBuffer(audioBuffer, options = {}) {
    try {
      const transcriptionOptions = {
        model: options.model || this.options.model,
        language: options.language || this.options.language,
        smart_format: options.smartFormat !== undefined ? options.smartFormat : this.options.smart_format,
        punctuate: options.punctuate !== false,
        diarize: options.diarize || false,
        utterances: options.utterances !== false,
        paragraphs: options.paragraphs !== false,
        ...options
      };

      const response = await this.client.listen.prerecorded.transcribeFile(
        audioBuffer,
        transcriptionOptions
      );

      return this.processTranscriptionResponse(response);
    } catch (error) {
      console.error('Failed to transcribe audio buffer:', error);
      throw error;
    }
  }

  processTranscriptionResponse(response) {
    const result = response.results;
    
    if (!result || !result.channels || result.channels.length === 0) {
      return {
        transcript: '',
        confidence: 0,
        words: [],
        isFinal: false,
        duration: 0
      };
    }

    const channel = result.channels[0];
    const alternative = channel.alternatives[0];

    return {
      transcript: alternative.transcript || '',
      confidence: alternative.confidence || 0,
      words: alternative.words || [],
      isFinal: result.is_final || false,
      duration: result.duration || 0,
      start: result.start || 0,
      speech_final: result.speech_final || false,
      rawResponse: response
    };
  }

  async sendAudioData(audioData) {
    if (!this.connection || !this.isConnected) {
      throw new Error('No active connection to send audio data');
    }

    try {
      this.connection.send(audioData);
    } catch (error) {
      console.error('Failed to send audio data:', error);
      throw error;
    }
  }

  async finishTranscription() {
    if (this.connection && this.isConnected) {
      try {
        this.connection.finish();
        await this.waitForConnectionClose();
      } catch (error) {
        console.error('Failed to finish transcription:', error);
        throw error;
      }
    }
  }

  async waitForConnectionClose(timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Connection close timeout'));
      }, timeout);

      if (!this.isConnected) {
        clearTimeout(timer);
        resolve();
        return;
      }

      const checkConnection = () => {
        if (!this.isConnected) {
          clearTimeout(timer);
          resolve();
        } else {
          setTimeout(checkConnection, 100);
        }
      };

      checkConnection();
    });
  }

  async closeConnection() {
    if (this.connection) {
      try {
        this.connection.finish();
        await this.waitForConnectionClose();
        this.connection = null;
        this.isConnected = false;
      } catch (error) {
        console.error('Failed to close connection:', error);
        throw error;
      }
    }
  }

  // Utility method to extract key phrases from transcript
  extractKeyPhrases(transcript) {
    const phrases = [
      'search for',
      'click on',
      'navigate to',
      'fill out',
      'scroll down',
      'scroll up',
      'go back',
      'refresh page',
      'take screenshot',
      'extract data',
      'sort by',
      'filter by',
      'open link',
      'close tab',
      'wait for',
      'confirm',
      'cancel',
      'proceed',
      'stop',
      'pause'
    ];

    const foundPhrases = phrases.filter(phrase => 
      transcript.toLowerCase().includes(phrase.toLowerCase())
    );

    return foundPhrases;
  }

  // Method to determine if transcript contains a command
  isCommand(transcript) {
    const commandIndicators = [
      'search', 'click', 'navigate', 'fill', 'scroll', 'go', 'refresh',
      'screenshot', 'extract', 'sort', 'filter', 'open', 'close', 'wait',
      'confirm', 'cancel', 'proceed', 'stop', 'pause'
    ];

    const lowerTranscript = transcript.toLowerCase();
    return commandIndicators.some(indicator => lowerTranscript.includes(indicator));
  }

  // Method to get confidence level description
  getConfidenceLevel(confidence) {
    if (confidence >= 0.9) return 'high';
    if (confidence >= 0.7) return 'medium';
    if (confidence >= 0.5) return 'low';
    return 'very_low';
  }
}

export default SpeechToText;
