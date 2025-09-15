import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AudioCapture {
  constructor(options = {}) {
    this.isRecording = false;
    this.recordingProcess = null;
    this.audioBuffer = [];
    this.sampleRate = options.sampleRate || process.env.AUDIO_SAMPLE_RATE || 16000;
    this.channels = options.channels || process.env.AUDIO_CHANNELS || 1;
    this.bitDepth = options.bitDepth || process.env.AUDIO_BIT_DEPTH || 16;
    this.tempDir = path.join(__dirname, '../../temp');
    this.ensureTempDir();
  }

  async ensureTempDir() {
    try {
      await fs.ensureDir(this.tempDir);
    } catch (error) {
      console.error('Failed to create temp directory:', error);
    }
  }

  async startRecording() {
    if (this.isRecording) {
      throw new Error('Already recording');
    }

    return new Promise((resolve, reject) => {
      try {
        // Use system audio capture (works on macOS, Linux, Windows with appropriate tools)
        const command = this.getAudioCaptureCommand();
        
        this.recordingProcess = spawn(command.program, command.args);
        
        this.recordingProcess.stdout.on('data', (data) => {
          this.audioBuffer.push(data);
        });

        this.recordingProcess.stderr.on('data', (data) => {
          console.error('Audio capture error:', data.toString());
        });

        this.recordingProcess.on('error', (error) => {
          console.error('Failed to start audio capture:', error);
          reject(error);
        });

        this.recordingProcess.on('spawn', () => {
          this.isRecording = true;
          console.log('🎤 Audio recording started');
          resolve();
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  async stopRecording() {
    if (!this.isRecording) {
      throw new Error('Not currently recording');
    }

    return new Promise((resolve, reject) => {
      try {
        if (this.recordingProcess) {
          this.recordingProcess.kill('SIGTERM');
          
          this.recordingProcess.on('exit', () => {
            this.isRecording = false;
            this.recordingProcess = null;
            console.log('🎤 Audio recording stopped');
            resolve();
          });
        } else {
          this.isRecording = false;
          resolve();
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  async getAudioData() {
    if (this.audioBuffer.length === 0) {
      return null;
    }

    const audioData = Buffer.concat(this.audioBuffer);
    this.audioBuffer = []; // Clear buffer after reading
    
    return audioData;
  }

  async saveAudioToFile(audioData, filename = null) {
    if (!audioData) {
      throw new Error('No audio data to save');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const audioFilename = filename || `audio_${timestamp}.wav`;
    const filePath = path.join(this.tempDir, audioFilename);

    try {
      await fs.writeFile(filePath, audioData);
      console.log(`💾 Audio saved to: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('Failed to save audio file:', error);
      throw error;
    }
  }

  getAudioCaptureCommand() {
    const platform = process.platform;
    
    switch (platform) {
      case 'darwin': // macOS
        return {
          program: 'rec',
          args: [
            '-r', this.sampleRate.toString(),
            '-c', this.channels.toString(),
            '-b', this.bitDepth.toString(),
            '-t', 'wav',
            '-'
          ]
        };
      
      case 'linux':
        return {
          program: 'arecord',
          args: [
            '-f', 'S16_LE',
            '-r', this.sampleRate.toString(),
            '-c', this.channels.toString(),
            '-D', 'default'
          ]
        };
      
      case 'win32':
        return {
          program: 'powershell',
          args: [
            '-Command',
            `Add-Type -AssemblyName System.Speech; $rec = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo([System.Speech.AudioFormat.EncodingFormat]::Pcm, ${this.sampleRate}, ${this.bitDepth}, ${this.channels}, ${this.sampleRate}, ${this.channels}, null); $rec.`
          ]
        };
      
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  // Alternative method using Web Audio API (for browser-based capture)
  async startWebAudioCapture(stream) {
    if (this.isRecording) {
      throw new Error('Already recording');
    }

    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, this.channels, this.channels);
      
      processor.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer;
        const audioData = new Float32Array(inputBuffer.length * this.channels);
        
        for (let channel = 0; channel < this.channels; channel++) {
          const channelData = inputBuffer.getChannelData(channel);
          for (let i = 0; i < channelData.length; i++) {
            audioData[i * this.channels + channel] = channelData[i];
          }
        }
        
        // Convert float32 to int16
        const int16Data = new Int16Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
          int16Data[i] = Math.max(-32768, Math.min(32767, audioData[i] * 32768));
        }
        
        this.audioBuffer.push(Buffer.from(int16Data.buffer));
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      this.isRecording = true;
      this.audioContext = audioContext;
      this.processor = processor;
      
      console.log('🎤 Web audio recording started');
    } catch (error) {
      console.error('Failed to start web audio capture:', error);
      throw error;
    }
  }

  async stopWebAudioCapture() {
    if (!this.isRecording) {
      throw new Error('Not currently recording');
    }

    try {
      if (this.processor) {
        this.processor.disconnect();
        this.processor = null;
      }
      
      if (this.audioContext) {
        await this.audioContext.close();
        this.audioContext = null;
      }
      
      this.isRecording = false;
      console.log('🎤 Web audio recording stopped');
    } catch (error) {
      console.error('Failed to stop web audio capture:', error);
      throw error;
    }
  }

  // Clean up temporary files
  async cleanup() {
    try {
      const files = await fs.readdir(this.tempDir);
      const audioFiles = files.filter(file => file.startsWith('audio_') && file.endsWith('.wav'));
      
      for (const file of audioFiles) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.stat(filePath);
        const ageInHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
        
        // Delete files older than 1 hour
        if (ageInHours > 1) {
          await fs.unlink(filePath);
          console.log(`🗑️ Cleaned up old audio file: ${file}`);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup audio files:', error);
    }
  }
}

export default AudioCapture;
