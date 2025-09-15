import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class FeedbackSystem {
  constructor(options = {}) {
    this.logsDir = path.join(__dirname, '../../logs');
    this.audioDir = path.join(__dirname, '../../audio');
    this.isEnabled = options.enabled !== false;
    this.ttsEnabled = options.ttsEnabled !== false;
    this.logLevel = options.logLevel || 'info';
    
    this.logLevels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    
    this.ensureDirectories();
    this.setupLogging();
  }

  async ensureDirectories() {
    try {
      await fs.ensureDir(this.logsDir);
      await fs.ensureDir(this.audioDir);
    } catch (error) {
      console.error('Failed to create feedback directories:', error);
    }
  }

  setupLogging() {
    this.logFile = path.join(this.logsDir, `session_${Date.now()}.log`);
    this.logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
  }

  log(level, message, data = null) {
    if (!this.isEnabled || this.logLevels[level] > this.logLevels[this.logLevel]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      data: data ? JSON.stringify(data, null, 2) : null
    };

    const logLine = `[${timestamp}] ${logEntry.level}: ${message}${data ? '\n' + data : ''}\n`;
    
    // Console output
    console.log(logLine.trim());
    
    // File output
    this.logStream.write(logLine);
  }

  async provideFeedback(type, content, socket = null) {
    try {
      const feedback = {
        type,
        content,
        timestamp: new Date().toISOString(),
        sessionId: this.getSessionId()
      };

      // Log the feedback
      this.log('info', `Feedback: ${type}`, feedback);

      // Emit to socket if available
      if (socket) {
        socket.emit('feedback', feedback);
      }

      // Generate text-to-speech if enabled
      if (this.ttsEnabled && type === 'speech') {
        await this.generateTTS(content);
      }

      return feedback;
    } catch (error) {
      this.log('error', 'Failed to provide feedback', { error: error.message });
      throw error;
    }
  }

  async generateTTS(text, options = {}) {
    try {
      if (!this.ttsEnabled) {
        return null;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `tts_${timestamp}.wav`;
      const filepath = path.join(this.audioDir, filename);

      // Use system TTS (platform-specific)
      const ttsCommand = this.getTTSCommand(text, filepath, options);
      
      return new Promise((resolve, reject) => {
        const process = spawn(ttsCommand.program, ttsCommand.args);
        
        process.on('error', (error) => {
          this.log('error', 'TTS generation failed', { error: error.message });
          reject(error);
        });

        process.on('exit', (code) => {
          if (code === 0) {
            this.log('info', `TTS generated: ${filename}`);
            resolve({
              filename,
              filepath,
              text,
              success: true
            });
          } else {
            reject(new Error(`TTS process exited with code ${code}`));
          }
        });
      });
    } catch (error) {
      this.log('error', 'TTS generation error', { error: error.message });
      throw error;
    }
  }

  getTTSCommand(text, outputPath, options = {}) {
    const platform = process.platform;
    const voice = options.voice || 'default';
    const rate = options.rate || 200;
    const volume = options.volume || 0.8;

    switch (platform) {
      case 'darwin': // macOS
        return {
          program: 'say',
          args: [
            '-v', voice,
            '-r', rate.toString(),
            '-o', outputPath,
            text
          ]
        };
      
      case 'linux':
        return {
          program: 'espeak',
          args: [
            '-s', rate.toString(),
            '-v', voice,
            '-w', outputPath,
            text
          ]
        };
      
      case 'win32':
        return {
          program: 'powershell',
          args: [
            '-Command',
            `Add-Type -AssemblyName System.Speech; $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; $synth.Rate = ${rate}; $synth.Volume = ${Math.round(volume * 100)}; $synth.SetOutputToWaveFile('${outputPath}'); $synth.Speak('${text.replace(/'/g, "''")}'); $synth.Dispose()`
          ]
        };
      
      default:
        throw new Error(`Unsupported platform for TTS: ${platform}`);
    }
  }

  async playAudio(audioPath) {
    try {
      const platform = process.platform;
      let command;

      switch (platform) {
        case 'darwin': // macOS
          command = { program: 'afplay', args: [audioPath] };
          break;
        case 'linux':
          command = { program: 'aplay', args: [audioPath] };
          break;
        case 'win32':
          command = { 
            program: 'powershell', 
            args: ['-Command', `(New-Object Media.SoundPlayer '${audioPath}').PlaySync()`] 
          };
          break;
        default:
          throw new Error(`Unsupported platform for audio playback: ${platform}`);
      }

      return new Promise((resolve, reject) => {
        const process = spawn(command.program, command.args);
        
        process.on('error', (error) => {
          this.log('error', 'Audio playback failed', { error: error.message });
          reject(error);
        });

        process.on('exit', (code) => {
          if (code === 0) {
            this.log('info', `Audio played: ${audioPath}`);
            resolve({ success: true });
          } else {
            reject(new Error(`Audio playback process exited with code ${code}`));
          }
        });
      });
    } catch (error) {
      this.log('error', 'Audio playback error', { error: error.message });
      throw error;
    }
  }

  async provideExecutionFeedback(intent, result, socket = null) {
    try {
      let feedbackMessage = '';
      let feedbackType = 'info';

      if (result.success === false) {
        feedbackMessage = `Command failed: ${intent.originalText}. Error: ${result.error || 'Unknown error'}`;
        feedbackType = 'error';
      } else {
        switch (intent.intent) {
          case 'search':
            feedbackMessage = `Searching for "${intent.parameters.query}" completed successfully.`;
            break;
          case 'click':
            feedbackMessage = `Clicked on ${intent.parameters.selector} successfully.`;
            break;
          case 'navigate':
            feedbackMessage = `Navigated to ${result.url || intent.parameters.url} successfully.`;
            break;
          case 'fill':
            feedbackMessage = `Filled ${intent.parameters.selector} with "${intent.parameters.value}" successfully.`;
            break;
          case 'scroll':
            feedbackMessage = `Scrolled ${intent.parameters.direction} successfully.`;
            break;
          case 'extract':
            const dataCount = Array.isArray(result.data) ? result.data.length : 1;
            feedbackMessage = `Extracted ${dataCount} items successfully.`;
            break;
          case 'screenshot':
            feedbackMessage = `Screenshot saved as ${result.filename} successfully.`;
            break;
          case 'wait':
            feedbackMessage = `Waited for ${intent.parameters.condition || 'element'} successfully.`;
            break;
          default:
            feedbackMessage = `Command "${intent.originalText}" executed successfully.`;
        }
      }

      // Provide text feedback
      await this.provideFeedback('text', feedbackMessage, socket);

      // Provide speech feedback
      if (this.ttsEnabled) {
        await this.provideFeedback('speech', feedbackMessage, socket);
      }

      // Provide visual feedback if screenshot was taken
      if (intent.intent === 'screenshot' && result.filepath) {
        await this.provideFeedback('screenshot', {
          filename: result.filename,
          filepath: result.filepath
        }, socket);
      }

      return {
        message: feedbackMessage,
        type: feedbackType,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.log('error', 'Failed to provide execution feedback', { error: error.message });
      throw error;
    }
  }

  async provideConfirmationFeedback(intent, socket = null) {
    try {
      const confirmationMessage = `This action requires confirmation: ${intent.originalText}. Risk level: ${intent.riskLevel}. Do you want to proceed?`;
      
      await this.provideFeedback('confirmation', {
        message: confirmationMessage,
        intent: intent.intent,
        riskLevel: intent.riskLevel,
        originalText: intent.originalText
      }, socket);

      if (this.ttsEnabled) {
        await this.provideFeedback('speech', confirmationMessage, socket);
      }

      return confirmationMessage;
    } catch (error) {
      this.log('error', 'Failed to provide confirmation feedback', { error: error.message });
      throw error;
    }
  }

  async provideErrorFeedback(error, intent = null, socket = null) {
    try {
      let errorMessage = `An error occurred: ${error.message}`;
      
      if (intent) {
        errorMessage = `Error executing "${intent.originalText}": ${error.message}`;
      }

      await this.provideFeedback('error', {
        message: errorMessage,
        error: error.message,
        stack: error.stack,
        intent: intent ? intent.intent : null
      }, socket);

      if (this.ttsEnabled) {
        await this.provideFeedback('speech', errorMessage, socket);
      }

      return errorMessage;
    } catch (feedbackError) {
      this.log('error', 'Failed to provide error feedback', { error: feedbackError.message });
      throw feedbackError;
    }
  }

  async provideStatusUpdate(status, details = null, socket = null) {
    try {
      const statusMessage = `Status: ${status}${details ? ` - ${details}` : ''}`;
      
      await this.provideFeedback('status', {
        status,
        details,
        timestamp: new Date().toISOString()
      }, socket);

      this.log('info', statusMessage);
      
      return statusMessage;
    } catch (error) {
      this.log('error', 'Failed to provide status update', { error: error.message });
      throw error;
    }
  }

  async provideProgressUpdate(step, total, description = '', socket = null) {
    try {
      const progress = Math.round((step / total) * 100);
      const progressMessage = `Progress: ${progress}% (${step}/${total}) - ${description}`;
      
      await this.provideFeedback('progress', {
        step,
        total,
        progress,
        description,
        timestamp: new Date().toISOString()
      }, socket);

      this.log('info', progressMessage);
      
      return {
        step,
        total,
        progress,
        description
      };
    } catch (error) {
      this.log('error', 'Failed to provide progress update', { error: error.message });
      throw error;
    }
  }

  async provideSummaryFeedback(sessionData, socket = null) {
    try {
      const summary = this.generateSessionSummary(sessionData);
      
      await this.provideFeedback('summary', summary, socket);

      if (this.ttsEnabled) {
        const summaryText = `Session completed. ${summary.totalActions} actions performed, ${summary.successfulActions} successful, ${summary.failedActions} failed.`;
        await this.provideFeedback('speech', summaryText, socket);
      }

      return summary;
    } catch (error) {
      this.log('error', 'Failed to provide summary feedback', { error: error.message });
      throw error;
    }
  }

  generateSessionSummary(sessionData) {
    const totalActions = sessionData.actions ? sessionData.actions.length : 0;
    const successfulActions = sessionData.actions ? sessionData.actions.filter(a => a.success).length : 0;
    const failedActions = totalActions - successfulActions;
    const extractedDataCount = sessionData.extractedData ? sessionData.extractedData.length : 0;
    const screenshotCount = sessionData.screenshots ? sessionData.screenshots.length : 0;

    return {
      sessionId: sessionData.sessionId,
      startTime: sessionData.startTime,
      endTime: new Date().toISOString(),
      duration: this.calculateDuration(sessionData.startTime),
      totalActions,
      successfulActions,
      failedActions,
      extractedDataCount,
      screenshotCount,
      currentUrl: sessionData.currentUrl,
      pageTitle: sessionData.pageTitle
    };
  }

  calculateDuration(startTime) {
    const start = new Date(startTime);
    const end = new Date();
    const diffMs = end - start;
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  getSessionId() {
    return process.env.SESSION_ID || `session_${Date.now()}`;
  }

  async cleanupOldFiles(maxAgeHours = 24) {
    try {
      // Cleanup old log files
      const logFiles = await fs.readdir(this.logsDir);
      for (const file of logFiles) {
        const filePath = path.join(this.logsDir, file);
        const stats = await fs.stat(filePath);
        const ageInHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
        
        if (ageInHours > maxAgeHours) {
          await fs.unlink(filePath);
          this.log('info', `Cleaned up old log file: ${file}`);
        }
      }

      // Cleanup old audio files
      const audioFiles = await fs.readdir(this.audioDir);
      for (const file of audioFiles) {
        const filePath = path.join(this.audioDir, file);
        const stats = await fs.stat(filePath);
        const ageInHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
        
        if (ageInHours > maxAgeHours) {
          await fs.unlink(filePath);
          this.log('info', `Cleaned up old audio file: ${file}`);
        }
      }
    } catch (error) {
      this.log('error', 'Failed to cleanup old files', { error: error.message });
    }
  }

  close() {
    if (this.logStream) {
      this.logStream.end();
    }
  }
}

export default FeedbackSystem;
