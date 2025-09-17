// Audio utility functions for better voice message compatibility

export const AudioUtils = {
  /**
   * Check if the browser supports a specific audio format
   */
  canPlayFormat(mimeType: string): boolean {
    const audio = new Audio();
    const support = audio.canPlayType(mimeType);
    return support === 'probably' || support === 'maybe';
  },

  /**
   * Get the best supported audio format for recording
   */
  getBestRecordingFormat(): { mimeType: string; extension: string } {
    const formats = [
      { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
      { mimeType: 'audio/webm', extension: 'webm' },
      { mimeType: 'audio/mp4', extension: 'm4a' },
      { mimeType: 'audio/ogg;codecs=opus', extension: 'ogg' },
      { mimeType: 'audio/wav', extension: 'wav' }
    ];

    for (const format of formats) {
      if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(format.mimeType)) {
        console.log('🎤 Selected recording format:', format);
        return format;
      }
    }

    // Fallback
    console.warn('⚠️ No optimal recording format found, using default');
    return { mimeType: 'audio/webm', extension: 'webm' };
  },

  /**
   * Get the best supported audio format for playback
   */
  getBestPlaybackFormat(): { mimeType: string; extension: string } {
    const formats = [
      { mimeType: 'audio/mp4', extension: 'm4a' },
      { mimeType: 'audio/mpeg', extension: 'mp3' },
      { mimeType: 'audio/wav', extension: 'wav' },
      { mimeType: 'audio/webm', extension: 'webm' },
      { mimeType: 'audio/ogg', extension: 'ogg' }
    ];

    for (const format of formats) {
      if (this.canPlayFormat(format.mimeType)) {
        console.log('🎤 Selected playback format:', format);
        return format;
      }
    }

    // Fallback
    console.warn('⚠️ No optimal playback format found, using MP3');
    return { mimeType: 'audio/mpeg', extension: 'mp3' };
  },

  /**
   * Convert audio blob to a more compatible format using Web Audio API
   */
  async convertToWAV(audioBlob: Blob): Promise<Blob> {
    try {
      console.log('🔄 Converting audio to WAV format...');
      
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Convert to WAV
      const wavBuffer = this.audioBufferToWav(audioBuffer);
      const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });
      
      console.log('✅ Audio converted to WAV successfully');
      return wavBlob;
    } catch (error) {
      console.error('❌ Audio conversion failed:', error);
      // Return original blob if conversion fails
      return audioBlob;
    }
  },

  /**
   * Convert AudioBuffer to WAV format
   */
  audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * 2, true);

    // Convert audio data
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
    }

    return arrayBuffer;
  },

  /**
   * Validate if an audio file is playable
   */
  async validateAudioFile(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      const audio = new Audio();
      
      const timeout = setTimeout(() => {
        console.warn('⚠️ Audio validation timeout');
        resolve(false);
      }, 5000);

      audio.oncanplay = () => {
        clearTimeout(timeout);
        console.log('✅ Audio file is valid and playable');
        resolve(true);
      };

      audio.onerror = (error) => {
        clearTimeout(timeout);
        console.error('❌ Audio file validation failed:', error);
        resolve(false);
      };

      audio.src = url;
    });
  },

  /**
   * Get browser audio support information
   */
  getBrowserAudioSupport() {
    const audio = new Audio();
    const support = {
      webm: audio.canPlayType('audio/webm'),
      ogg: audio.canPlayType('audio/ogg'),
      mp4: audio.canPlayType('audio/mp4'),
      wav: audio.canPlayType('audio/wav'),
      mp3: audio.canPlayType('audio/mpeg'),
      mediaRecorder: !!window.MediaRecorder,
      webAudio: !!(window.AudioContext || (window as any).webkitAudioContext)
    };

    console.log('🎤 Browser audio support:', support);
    return support;
  }
};

export default AudioUtils;