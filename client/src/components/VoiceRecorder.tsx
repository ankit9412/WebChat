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
  MicOff,
  Stop,
  PlayArrow,
  Pause,
  Send,
  Close,
} from '@mui/icons-material';
import AudioUtils from '../utils/audioUtils';

interface VoiceRecorderProps {
  onSend: (voiceData: { url: string; duration: number; waveform: number[] }) => void;
  onCancel: () => void;
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onSend, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [waveform, setWaveform] = useState<number[]>([]);
  const [audioFormat, setAudioFormat] = useState<string>('audio/webm');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      // Get browser audio support info
      AudioUtils.getBrowserAudioSupport();
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Use AudioUtils to get the best recording format
      const bestFormat = AudioUtils.getBestRecordingFormat();
      
      let mediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(stream, { mimeType: bestFormat.mimeType });
        console.log('🎤 Using optimal format:', bestFormat.mimeType);
      } catch (error) {
        console.warn('🎤 Optimal format failed, trying default:', error);
        mediaRecorder = new MediaRecorder(stream);
        bestFormat.mimeType = 'audio/webm'; // Fallback
      }
      
      // Store the format in state for use in the onstop callback
      setAudioFormat(bestFormat.mimeType);
      mediaRecorderRef.current = mediaRecorder;
      console.log('🎤 Final selected format:', bestFormat.mimeType);
      
      const audioChunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };
      
      mediaRecorder.onstop = () => {
        console.log('🎤 Recording stopped, processing audio...');
        
        // Create audio blob with the format that was used for recording
        const audioBlob = new Blob(audioChunks, { type: audioFormat });
        console.log('🎤 Created audio blob with format:', audioFormat);
        
        const audioUrl = URL.createObjectURL(audioBlob);
        
        console.log('🎤 Audio blob created:', {
          size: audioBlob.size,
          type: audioBlob.type,
          url: audioUrl
        });
        
        setAudioBlob(audioBlob);
        setAudioUrl(audioUrl);
        
        // Generate waveform data (simplified)
        const waveformData = Array.from({ length: 50 }, () => Math.random() * 100);
        setWaveform(waveformData);
        
        // Test audio creation with error handling
        const testAudio = new Audio(audioUrl);
        testAudio.oncanplay = () => {
          console.log('✅ Audio is ready for playback');
        };
        testAudio.onerror = (error) => {
          console.error('❌ Audio playback test error:', error);
          console.error('Audio error details:', {
            code: testAudio.error?.code,
            message: testAudio.error?.message
          });
        };
        testAudio.onloadstart = () => {
          console.log('📦 Audio loading started');
        };
        testAudio.onloadeddata = () => {
          console.log('✅ Audio data loaded successfully');
        };
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);
      
      // Update duration every 100ms
      intervalRef.current = setInterval(() => {
        setDuration(prev => prev + 0.1);
      }, 100);
      
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
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
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleSend = () => {
    if (audioBlob) {
      // In a real app, you would upload the audio file to the server
      // For now, we'll simulate it
      onSend({
        url: audioUrl,
        duration: Math.round(duration),
        waveform: waveform,
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
            Tap to start recording
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
              Voice message ({formatDuration(duration)})
            </Typography>
            <Box className="voice-waveform" sx={{ mt: 1 }}>
              {waveform.map((height, index) => (
                <Box
                  key={index}
                  className="voice-bar"
                  sx={{
                    height: `${height}%`,
                    bgcolor: 'primary.main',
                  }}
                />
              ))}
            </Box>
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

export default VoiceRecorder;
