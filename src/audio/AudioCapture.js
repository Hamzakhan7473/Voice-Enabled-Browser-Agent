import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class AudioCapture {
    constructor(options = {}) {
        this.isRecording = false;
        this.audioStream = null;
        this.recordingProcess = null;
        this.deepgramClient = null;
        this.liveConnection = null;
        this.options = {
            sampleRate: 16000,
            channels: 1,
            bitDepth: 16,
            format: 'wav',
            ...options
        };
        this.eventListeners = new Map();
        this.audioBuffer = [];
        this.isStreaming = false;
        this.tempDir = path.join(__dirname, '../../temp');
        this.ensureTempDir();
    }

    /**
     * Initialize Deepgram client for real-time streaming
     */
    async initializeDeepgram(apiKey) {
        try {
            this.deepgramClient = createClient(apiKey);
            console.log('✅ Deepgram client initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Deepgram client:', error);
            throw error;
        }
    }

    /**
     * Start capturing audio from the microphone with real-time streaming
     */
    async startCapture() {
        if (this.isRecording) {
            throw new Error('Audio capture is already running');
        }

        try {
            this.isRecording = true;
            this.emit('capture-started');
            
            // Start platform-specific audio capture
            await this.startPlatformCapture();
            
            // Initialize real-time streaming to Deepgram
            if (this.deepgramClient) {
                await this.startLiveTranscription();
            }
            
        } catch (error) {
            this.isRecording = false;
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Start live transcription with Deepgram
     */
    async startLiveTranscription() {
        if (!this.deepgramClient) {
            throw new Error('Deepgram client not initialized');
        }

        try {
            // Create live transcription connection
            this.liveConnection = this.deepgramClient.listen.live({
                model: "nova-2",
                language: "en-US",
                smart_format: true,
                interim_results: true,
                endpointing: 300,
                vad_events: true,
                encoding: "linear16",
                sample_rate: this.options.sampleRate,
                channels: this.options.channels
            });

            // Set up event listeners for live transcription
            this.setupLiveTranscriptionEvents();
            
            console.log('🎙️ Live transcription started');
            
        } catch (error) {
            console.error('❌ Failed to start live transcription:', error);
            throw error;
        }
    }

    /**
     * Set up event listeners for live transcription
     */
    setupLiveTranscriptionEvents() {
        this.liveConnection.on(LiveTranscriptionEvents.Open, () => {
            console.log('🔗 Live transcription connection opened');
            this.emit('transcription-connected');
        });

        this.liveConnection.on(LiveTranscriptionEvents.Close, () => {
            console.log('🔌 Live transcription connection closed');
            this.emit('transcription-disconnected');
        });

        this.liveConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
            const transcript = data.channel.alternatives[0].transcript;
            const confidence = data.channel.alternatives[0].confidence;
            const isFinal = data.is_final;
            
            console.log(`📝 Transcript (${isFinal ? 'FINAL' : 'INTERIM'}): ${transcript}`);
            
            this.emit('transcript', {
                text: transcript,
                confidence: confidence,
                isFinal: isFinal,
                timestamp: Date.now(),
                words: data.channel.alternatives[0].words || []
            });
        });

        this.liveConnection.on(LiveTranscriptionEvents.Metadata, (data) => {
            console.log('📊 Transcription metadata:', data);
            this.emit('metadata', data);
        });

        this.liveConnection.on(LiveTranscriptionEvents.Error, (error) => {
            console.error('❌ Live transcription error:', error);
            this.emit('transcription-error', error);
        });

        this.liveConnection.on(LiveTranscriptionEvents.Warning, (warning) => {
            console.warn('⚠️ Live transcription warning:', warning);
            this.emit('transcription-warning', warning);
        });

        this.liveConnection.on(LiveTranscriptionEvents.UtteranceEnd, (data) => {
            console.log('🔚 Utterance ended:', data);
            this.emit('utterance-end', data);
        });
    }

    /**
     * Send audio data to Deepgram for real-time transcription
     */
    sendAudioData(audioData) {
        if (this.liveConnection && this.isRecording) {
            try {
                this.liveConnection.send(audioData);
            } catch (error) {
                console.error('❌ Failed to send audio data:', error);
                this.emit('error', error);
            }
        }
    }

    /**
     * Stop capturing audio
     */
    async stopCapture() {
        if (!this.isRecording) {
            return;
        }

        try {
            this.isRecording = false;
            
            // Close live transcription connection
            if (this.liveConnection) {
                this.liveConnection.finish();
                this.liveConnection = null;
            }
            
            // Stop platform-specific audio capture
            if (this.recordingProcess) {
                this.recordingProcess.kill();
                this.recordingProcess = null;
            }

            this.emit('capture-stopped');
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Start platform-specific audio capture with streaming
     */
    async startPlatformCapture() {
        const platform = process.platform;
        
        switch (platform) {
            case 'darwin': // macOS
                await this.startMacOSCapture();
                break;
            case 'win32': // Windows
                await this.startWindowsCapture();
                break;
            case 'linux': // Linux
                await this.startLinuxCapture();
                break;
            default:
                throw new Error(`Unsupported platform: ${platform}`);
        }
    }

    /**
     * Start audio capture on macOS with real-time streaming
     */
    async startMacOSCapture() {
        // Use sox for macOS audio capture with real-time streaming
        this.recordingProcess = spawn('rec', [
            '-r', this.options.sampleRate.toString(),
            '-c', this.options.channels.toString(),
            '-b', this.options.bitDepth.toString(),
            '-t', 'raw', // Raw audio data for streaming
            '-' // Output to stdout
        ]);

        this.recordingProcess.stdout.on('data', (chunk) => {
            this.sendAudioData(chunk);
            this.audioBuffer.push(chunk);
        });

        this.recordingProcess.on('error', (error) => {
            this.emit('error', new Error(`macOS audio capture failed: ${error.message}`));
        });

        this.recordingProcess.on('exit', (code) => {
            if (code !== 0) {
                this.emit('error', new Error(`Audio capture process exited with code ${code}`));
            }
        });
    }

    /**
     * Start audio capture on Windows with real-time streaming
     */
    async startWindowsCapture() {
        // Use PowerShell with Windows Audio Session API for real-time capture
        const psCommand = `
            Add-Type -AssemblyName System.Speech
            $audioFormat = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
            # Additional Windows-specific real-time audio capture logic
        `;
        
        this.recordingProcess = spawn('powershell', ['-Command', psCommand]);
        
        this.recordingProcess.stdout.on('data', (chunk) => {
            this.sendAudioData(chunk);
            this.audioBuffer.push(chunk);
        });
        
        this.recordingProcess.on('error', (error) => {
            this.emit('error', new Error(`Windows audio capture failed: ${error.message}`));
        });
    }

    /**
     * Start audio capture on Linux with real-time streaming
     */
    async startLinuxCapture() {
        // Use arecord for Linux audio capture with real-time streaming
        this.recordingProcess = spawn('arecord', [
            '-f', 'S16_LE',
            '-r', this.options.sampleRate.toString(),
            '-c', this.options.channels.toString(),
            '-' // Output to stdout
        ]);

        this.recordingProcess.stdout.on('data', (chunk) => {
            this.sendAudioData(chunk);
            this.audioBuffer.push(chunk);
        });

        this.recordingProcess.on('error', (error) => {
            this.emit('error', new Error(`Linux audio capture failed: ${error.message}`));
        });
    }

    /**
     * Get current recording status
     */
    getStatus() {
        return {
            isRecording: this.isRecording,
            isStreaming: this.isStreaming,
            options: this.options,
            platform: process.platform,
            hasDeepgramConnection: !!this.liveConnection
        };
    }

    /**
     * Get audio data from buffer
     */
    async getAudioData() {
        if (this.audioBuffer.length === 0) {
            return null;
        }

        const audioData = Buffer.concat(this.audioBuffer);
        this.audioBuffer = []; // Clear buffer after reading
        
        return audioData;
    }

    /**
     * Save audio data to file
     */
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
            console.error('❌ Failed to save audio file:', error);
            throw error;
        }
    }

    /**
     * Ensure temp directory exists
     */
    async ensureTempDir() {
        try {
            await fs.ensureDir(this.tempDir);
        } catch (error) {
            console.error('❌ Failed to create temp directory:', error);
        }
    }

    /**
     * Add event listener
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    /**
     * Remove event listener
     */
    off(event, callback) {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * Emit event to all listeners
     */
    emit(event, ...args) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    console.error(`❌ Error in event listener for ${event}:`, error);
                }
            });
        }
    }

    /**
     * Clean up resources
     */
    async cleanup() {
        await this.stopCapture();
        this.eventListeners.clear();
        
        // Clean up old audio files
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
            console.error('❌ Failed to cleanup audio files:', error);
        }
    }
}