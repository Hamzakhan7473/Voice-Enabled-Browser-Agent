import AudioCapture from '../audio/AudioCapture.js';
import SpeechToText from '../speech/SpeechToText.js';
import IntentParser from '../nlp/IntentParser.js';
import BrowserController from '../browser/BrowserController.js';
import ContextManager from '../context/ContextManager.js';
import FeedbackSystem from '../feedback/FeedbackSystem.js';
import ErrorHandler from '../utils/ErrorHandler.js';
import CommandExecutor from './CommandExecutor.js';

class VoiceAgent {
  constructor(options = {}) {
    this.audioCapture = options.audioCapture || new AudioCapture();
    this.speechToText = options.speechToText || new SpeechToText();
    this.intentParser = options.intentParser || new IntentParser();
    this.browserController = options.browserController || new BrowserController();
    this.contextManager = options.contextManager || new ContextManager();
    this.feedbackSystem = options.feedbackSystem || new FeedbackSystem();
    this.errorHandler = options.errorHandler || new ErrorHandler();
    
    this.commandExecutor = new CommandExecutor({
      browserController: this.browserController,
      contextManager: this.contextManager,
      errorHandler: this.errorHandler
    });

    this.isListening = false;
    this.isProcessing = false;
    this.currentSocket = null;
    this.sessionActive = false;
    
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // Handle audio capture events
    this.audioCapture.on('audio-data', (audioData) => {
      this.handleAudioData(audioData);
    });

    this.audioCapture.on('error', (error) => {
      this.handleAudioError(error);
    });
  }

  async initialize() {
    try {
      console.log('🚀 Initializing Voice Agent...');
      
      // Initialize browser session
      await this.browserController.createSession();
      
      // Load context if available
      await this.contextManager.loadContext();
      
      this.sessionActive = true;
      console.log('✅ Voice Agent initialized successfully');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Voice Agent:', error);
      throw error;
    }
  }

  async startListening(socket = null) {
    try {
      if (this.isListening) {
        throw new Error('Already listening');
      }

      this.currentSocket = socket;
      this.isListening = true;

      console.log('🎤 Starting voice listening...');
      
      // Start audio capture
      await this.audioCapture.startRecording();
      
      // Start live transcription
      await this.speechToText.startLiveTranscription(
        (data) => this.handleTranscription(data),
        (error) => this.handleTranscriptionError(error)
      );

      // Provide feedback
      await this.feedbackSystem.provideStatusUpdate('Listening for voice commands', null, socket);
      
      if (socket) {
        socket.emit('listening-started', {
          timestamp: new Date().toISOString(),
          sessionId: this.contextManager.sessionId
        });
      }

      return true;
    } catch (error) {
      console.error('Failed to start listening:', error);
      this.isListening = false;
      throw error;
    }
  }

  async stopListening() {
    try {
      if (!this.isListening) {
        throw new Error('Not currently listening');
      }

      console.log('🎤 Stopping voice listening...');
      
      // Stop audio capture
      await this.audioCapture.stopRecording();
      
      // Finish transcription
      await this.speechToText.finishTranscription();
      
      this.isListening = false;

      // Provide feedback
      await this.feedbackSystem.provideStatusUpdate('Stopped listening', null, this.currentSocket);
      
      if (this.currentSocket) {
        this.currentSocket.emit('listening-stopped', {
          timestamp: new Date().toISOString()
        });
      }

      return true;
    } catch (error) {
      console.error('Failed to stop listening:', error);
      throw error;
    }
  }

  async handleAudioData(audioData) {
    try {
      if (this.speechToText.isConnected) {
        await this.speechToText.sendAudioData(audioData);
      }
    } catch (error) {
      console.error('Failed to send audio data:', error);
    }
  }

  async handleTranscription(data) {
    try {
      const transcript = data.channel?.alternatives?.[0]?.transcript;
      const confidence = data.channel?.alternatives?.[0]?.confidence;
      const isFinal = data.is_final;

      if (!transcript || transcript.trim().length === 0) {
        return;
      }

      console.log(`📝 Transcript: "${transcript}" (confidence: ${confidence}, final: ${isFinal})`);

      // Emit transcript to client
      if (this.currentSocket) {
        this.currentSocket.emit('transcript', {
          transcript,
          confidence,
          isFinal,
          timestamp: new Date().toISOString()
        });
      }

      // Process final transcripts
      if (isFinal && confidence > 0.5) {
        await this.processTranscript(transcript);
      }
    } catch (error) {
      console.error('Failed to handle transcription:', error);
    }
  }

  async handleTranscriptionError(error) {
    console.error('Transcription error:', error);
    
    await this.feedbackSystem.provideErrorFeedback(error, null, this.currentSocket);
  }

  async handleAudioError(error) {
    console.error('Audio capture error:', error);
    
    await this.feedbackSystem.provideErrorFeedback(error, null, this.currentSocket);
  }

  async processTranscript(transcript) {
    try {
      if (this.isProcessing) {
        console.log('⏳ Already processing a command, skipping...');
        return;
      }

      this.isProcessing = true;
      
      console.log(`🧠 Processing transcript: "${transcript}"`);
      
      // Provide status update
      await this.feedbackSystem.provideStatusUpdate('Processing command...', null, this.currentSocket);

      // Parse intent from transcript
      const context = this.contextManager.getContextForIntentParsing();
      const intent = await this.intentParser.parseIntent(transcript, context);
      
      console.log(`🎯 Parsed intent: ${intent.intent}`, intent.parameters);

      // Validate intent
      const validation = this.errorHandler.validateIntent(intent);
      if (!validation.isValid) {
        throw new Error(`Invalid intent: ${validation.errors.join(', ')}`);
      }

      // Enhance intent with context
      const enhancedIntent = await this.contextManager.enhanceIntentWithContext(intent);

      // Emit parsed intent to client
      if (this.currentSocket) {
        this.currentSocket.emit('intent-parsed', {
          intent: enhancedIntent.intent,
          parameters: enhancedIntent.parameters,
          confidence: enhancedIntent.confidence,
          requiresConfirmation: enhancedIntent.requiresConfirmation,
          riskLevel: enhancedIntent.riskLevel,
          originalText: enhancedIntent.originalText,
          timestamp: new Date().toISOString()
        });
      }

      // Execute the command
      await this.executeCommand(enhancedIntent);

    } catch (error) {
      console.error('Failed to process transcript:', error);
      
      await this.feedbackSystem.provideErrorFeedback(error, null, this.currentSocket);
      
      // Handle error recovery
      await this.errorHandler.handleError(error, { originalText: transcript }, {
        socket: this.currentSocket
      });
    } finally {
      this.isProcessing = false;
    }
  }

  async executeCommand(intent) {
    try {
      console.log(`⚡ Executing command: ${intent.intent}`);
      
      // Provide status update
      await this.feedbackSystem.provideStatusUpdate(
        `Executing: ${intent.originalText}`,
        null,
        this.currentSocket
      );

      // Execute the command
      const result = await this.commandExecutor.executeIntent(intent, this.currentSocket);

      // Provide execution feedback
      await this.feedbackSystem.provideExecutionFeedback(intent, result, this.currentSocket);

      // Update page context
      const pageInfo = await this.browserController.getPageInfo();
      await this.contextManager.updatePageContext(pageInfo);

      console.log(`✅ Command executed successfully: ${intent.intent}`);

      return result;
    } catch (error) {
      console.error(`❌ Command execution failed: ${intent.intent}`, error);
      
      // Add error to context
      await this.contextManager.addError(error, intent);
      
      // Provide error feedback
      await this.feedbackSystem.provideErrorFeedback(error, intent, this.currentSocket);
      
      throw error;
    }
  }

  async executeCommandDirect(command) {
    try {
      if (this.isProcessing) {
        throw new Error('Another command is currently being processed');
      }

      this.isProcessing = true;
      
      console.log(`⚡ Executing direct command: ${command.intent}`);
      
      // Execute the command
      const result = await this.commandExecutor.executeIntent(command, this.currentSocket);

      // Provide execution feedback
      await this.feedbackSystem.provideExecutionFeedback(command, result, this.currentSocket);

      // Update page context
      const pageInfo = await this.browserController.getPageInfo();
      await this.contextManager.updatePageContext(pageInfo);

      return result;
    } catch (error) {
      console.error(`❌ Direct command execution failed: ${command.intent}`, error);
      
      // Add error to context
      await this.contextManager.addError(error, command);
      
      // Provide error feedback
      await this.feedbackSystem.provideErrorFeedback(error, command, this.currentSocket);
      
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  async takeScreenshot(options = {}) {
    try {
      const result = await this.browserController.takeScreenshot(
        options.selector,
        options.fullPage
      );
      
      await this.feedbackSystem.provideFeedback('screenshot', {
        filename: result.filename,
        filepath: result.filepath
      }, this.currentSocket);
      
      return result;
    } catch (error) {
      console.error('Screenshot failed:', error);
      throw error;
    }
  }

  async extractData(options = {}) {
    try {
      const result = await this.browserController.extractData(
        options.selector,
        options.dataType
      );
      
      await this.feedbackSystem.provideFeedback('data-extracted', {
        dataType: options.dataType,
        count: Array.isArray(result.data) ? result.data.length : 1,
        selector: options.selector
      }, this.currentSocket);
      
      return result;
    } catch (error) {
      console.error('Data extraction failed:', error);
      throw error;
    }
  }

  async getSessionSummary() {
    try {
      const browserData = this.browserController.getSessionData();
      const contextSummary = this.contextManager.getContextSummary();
      const errorStats = this.errorHandler.getErrorStatistics();
      
      return {
        ...contextSummary,
        browserData,
        errorStats,
        isListening: this.isListening,
        isProcessing: this.isProcessing,
        sessionActive: this.sessionActive
      };
    } catch (error) {
      console.error('Failed to get session summary:', error);
      throw error;
    }
  }

  async exportSession(format = 'json') {
    try {
      const sessionData = await this.getSessionSummary();
      const contextExport = await this.contextManager.exportContext(format);
      
      return {
        sessionData,
        contextFile: contextExport,
        format
      };
    } catch (error) {
      console.error('Failed to export session:', error);
      throw error;
    }
  }

  async cleanup() {
    try {
      console.log('🧹 Cleaning up Voice Agent...');
      
      // Stop listening if active
      if (this.isListening) {
        await this.stopListening();
      }
      
      // Close browser session
      await this.browserController.closeSession();
      
      // Close speech-to-text connection
      await this.speechToText.closeConnection();
      
      // Cleanup feedback system
      this.feedbackSystem.close();
      
      // Cleanup old files
      await this.contextManager.cleanupOldContexts();
      await this.feedbackSystem.cleanupOldFiles();
      
      this.sessionActive = false;
      console.log('✅ Voice Agent cleanup completed');
      
    } catch (error) {
      console.error('Failed to cleanup Voice Agent:', error);
      throw error;
    }
  }

  // Utility methods for external control
  getStatus() {
    return {
      isListening: this.isListening,
      isProcessing: this.isProcessing,
      sessionActive: this.sessionActive,
      currentUrl: this.contextManager.contextData.currentUrl,
      pageTitle: this.contextManager.contextData.pageTitle,
      sessionId: this.contextManager.sessionId
    };
  }

  async navigate(url) {
    return await this.browserController.navigate(url);
  }

  async getPageInfo() {
    return await this.browserController.getPageInfo();
  }

  async refreshPage() {
    return await this.browserController.page.reload();
  }

  async goBack() {
    return await this.browserController.page.goBack();
  }

  async goForward() {
    return await this.browserController.page.goForward();
  }
}

export default VoiceAgent;
