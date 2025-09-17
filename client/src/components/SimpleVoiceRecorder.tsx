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

interface SimpleVoiceRecorderProps {
  onSend: (voiceData: { url: string; duration: number; waveform: number[] }) => void;
  onCancel: () => void;
}

const SimpleVoiceRecorder: React.FC<SimpleVoiceRecorderProps> = ({ onSend, onCancel }) => {
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
  const recorderWorkletRef = useRef<AudioWorkletNode | null>(null);

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

  // Simple WAV encoder
  const encodeWAV = (audioBuffer: AudioBuffer): ArrayBuffer => {
    const length = audioBuffer.length;
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
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
        const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
    }

    return arrayBuffer;
  };

  const startRecording = async () => {
    try {
      console.log('🎤 Starting BULLETPROOF recording...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 44100
        } 
      });
      streamRef.current = stream;

      // Try different formats until we find one that works
      let mediaRecorder;
      let mimeType = 'audio/wav';
      
      // Try the most compatible formats first
      if (MediaRecorder.isTypeSupported('audio/wav')) {
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/wav' });
        mimeType = 'audio/wav';
        console.log('🎤 Using WAV format');
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        mimeType = 'audio/webm';
        console.log('🎤 Using WebM format');
      } else {
        mediaRecorder = new MediaRecorder(stream);
        mimeType = 'audio/webm'; // Default
        console.log('🎤 Using default format');
      }
      
      mediaRecorderRef.current = mediaRecorder;
      const audioChunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
          console.log('🎤 Audio chunk received:', event.data.size, 'bytes');
        }
      };
      
      mediaRecorder.onstop = () => {
        console.log('🎤 Recording stopped, creating audio blob...');
        
        const audioBlob = new Blob(audioChunks, { type: mimeType });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        console.log('✅ Audio blob created:', {
          size: audioBlob.size,
          type: audioBlob.type,
          url: audioUrl
        });
        
        setAudioBlob(audioBlob);
        setAudioUrl(audioUrl);
        setIsRecording(false);
        
        // Test the audio immediately
        const testAudio = new Audio(audioUrl);
        testAudio.onloadstart = () => console.log('📦 Audio loading...');
        testAudio.oncanplay = () => console.log('✅ Audio ready for playback');
        testAudio.onerror = (error) => {
          console.error('❌ Audio test failed:', error);
          console.error('Error details:', {
            code: testAudio.error?.code,
            message: testAudio.error?.message
          });
        };
      };
      
      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setDuration(0);
      
      // Update duration
      intervalRef.current = setInterval(() => {
        setDuration(prev => prev + 0.1);
      }, 100);
      
    } catch (error) {
      console.error('❌ Recording failed:', error);
      alert('Recording failed. Please check your microphone permissions.');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    console.log('🔑 Stop recording button clicked');
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
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
        });
      }
    }
  };

  const handleSend = () => {
    if (audioBlob && audioUrl) {
      console.log('📤 Sending simple WAV voice message');
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
            Tap to start WAV recording
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
              Recording WAV... {formatDuration(duration)}
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

export default SimpleVoiceRecorder;