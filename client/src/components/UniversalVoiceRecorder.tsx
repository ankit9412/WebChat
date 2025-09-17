import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  IconButton,
  Typography,
  LinearProgress,
  Button,
  Paper,
} from '@mui/material';
import {
  Mic,
  Stop,
  PlayArrow,
  Pause,
  Send,
  Close,
} from '@mui/icons-material';

interface UniversalVoiceRecorderProps {
  onSend: (voiceData: { url: string; duration: number; waveform: number[] }) => void;
  onCancel: () => void;
}

const UniversalVoiceRecorder: React.FC<UniversalVoiceRecorderProps> = ({ onSend, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
  };

  // Convert Float32Array to Int16Array for WAV
  const float32ToInt16 = (buffer: Float32Array): Int16Array => {
    const length = buffer.length;
    const result = new Int16Array(length);
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, buffer[i]));
      result[i] = sample * 0x7FFF;
    }
    return result;
  };

  // Create WAV file from audio buffer
  const createWAVBlob = (audioBuffer: AudioBuffer): Blob => {
    const numberOfChannels = 1; // Mono
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;
    
    // Get audio data and convert to Int16
    const audioData = audioBuffer.getChannelData(0);
    const int16Data = float32ToInt16(audioData);
    
    // Calculate sizes
    const dataSize = int16Data.length * 2;
    const fileSize = 44 + dataSize;
    
    // Create WAV header
    const arrayBuffer = new ArrayBuffer(fileSize);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, fileSize - 8, true);
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
    view.setUint32(40, dataSize, true);
    
    // Write audio data
    let offset = 44;
    for (let i = 0; i < int16Data.length; i++) {
      view.setInt16(offset, int16Data[i], true);
      offset += 2;
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  };

  const startRecording = async () => {
    try {
      console.log('🎤 Starting UNIVERSAL recording...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 44100,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      streamRef.current = stream;

      // Use Web Audio API to capture raw audio data
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 44100
      });
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      
      // Use ScriptProcessorNode for maximum compatibility
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      const audioChunks: Float32Array[] = [];
      
      processor.onaudioprocess = (e) => {
        const inputBuffer = e.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);
        // Copy the data to avoid issues with buffer reuse
        audioChunks.push(new Float32Array(inputData));
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      setIsRecording(true);
      setDuration(0);
      
      // Update duration
      intervalRef.current = setInterval(() => {
        setDuration(prev => prev + 0.1);
      }, 100);
      
      // Store stop function
      (window as any).stopUniversalRecording = () => {
        console.log('🎤 Stopping recording and converting to WAV...');
        
        processor.disconnect();
        source.disconnect();
        
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        
        // Create AudioBuffer from chunks
        const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const audioBuffer = audioContext.createBuffer(1, totalLength, audioContext.sampleRate);
        const channelData = audioBuffer.getChannelData(0);
        
        let offset = 0;
        audioChunks.forEach(chunk => {
          channelData.set(chunk, offset);
          offset += chunk.length;
        });
        
        // Convert to WAV
        const wavBlob = createWAVBlob(audioBuffer);
        const wavUrl = URL.createObjectURL(wavBlob);
        
        console.log('✅ WAV audio created:', {
          size: wavBlob.size,
          type: wavBlob.type,
          url: wavUrl,
          duration: duration
        });
        
        setAudioBlob(wavBlob);
        setAudioUrl(wavUrl);
        setIsRecording(false);
        
        // Test the audio
        const testAudio = new Audio(wavUrl);
        testAudio.oncanplay = () => console.log('✅ WAV audio ready');
        testAudio.onerror = (error) => console.error('❌ WAV test failed:', error);
      };
      
    } catch (error) {
      console.error('❌ Recording failed:', error);
      alert('Recording failed. Please check microphone permissions.');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (isRecording && (window as any).stopUniversalRecording) {
      (window as any).stopUniversalRecording();
    }
  };

  const playRecording = () => {
    if (audioUrl && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(error => {
          console.error('❌ Playback failed:', error);
          alert('Playback failed: ' + error.message);
        });
      }
    }
  };

  const handleSend = () => {
    if (audioBlob && audioUrl) {
      console.log('📤 Sending WAV voice message');
      onSend({
        url: audioUrl,
        duration: Math.round(duration),
        waveform: Array.from({ length: 50 }, () => Math.random() * 100),
      });
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Paper
      elevation={2}
      sx={{
        p: 2,
        mt: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        bgcolor: 'background.paper',
      }}
    >
      {!isRecording && !audioBlob && (
        <>
          <IconButton
            color="primary"
            onClick={startRecording}
            sx={{ bgcolor: 'primary.main', color: 'white' }}
          >
            <Mic />
          </IconButton>
          <Typography variant="body2" color="text.secondary">
            Tap to start recording (WAV format)
          </Typography>
          <Button onClick={onCancel} size="small">
            Cancel
          </Button>
        </>
      )}

      {isRecording && (
        <>
          <IconButton
            color="error"
            onClick={stopRecording}
            sx={{ bgcolor: 'error.main', color: 'white' }}
          >
            <Stop />
          </IconButton>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" color="error">
              Recording... {formatDuration(duration)}
            </Typography>
            <LinearProgress color="error" />
          </Box>
        </>
      )}

      {audioBlob && !isRecording && (
        <>
          <IconButton onClick={playRecording} color="primary">
            {isPlaying ? <Pause /> : <PlayArrow />}
          </IconButton>
          
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2">
              WAV voice message ({formatDuration(duration)})
            </Typography>
          </Box>

          <IconButton onClick={handleSend} color="primary">
            <Send />
          </IconButton>
          <IconButton onClick={onCancel}>
            <Close />
          </IconButton>
        </>
      )}

      <audio
        ref={audioRef}
        src={audioUrl}
        onEnded={() => setIsPlaying(false)}
        style={{ display: 'none' }}
      />
    </Paper>
  );
};

export default UniversalVoiceRecorder;