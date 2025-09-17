import React, { useEffect, useState } from 'react';
import {
  Dialog,
  Box,
  Avatar,
  Typography,
  IconButton,
  Paper,
  Slide,
} from '@mui/material';
import {
  Call,
  CallEnd,
  Videocam,
} from '@mui/icons-material';
import { TransitionProps } from '@mui/material/transitions';
import { useSocket } from '../contexts/SocketContext';

interface User {
  _id: string;
  username: string;
  email: string;
  profilePicture?: string;
}

interface CallNotificationProps {
  open: boolean;
  type: 'audio' | 'video' | null;
  caller: User | null;
  onAccept: () => void;
  onReject: () => void;
}

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="down" ref={ref} {...props} />;
});

const CallNotification: React.FC<CallNotificationProps> = ({
  open,
  type,
  caller,
  onAccept,
  onReject,
}) => {
  const { emit } = useSocket();
  const [ringingTimeout, setRingingTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let audio: HTMLAudioElement | null = null;
    
    if (open && caller) {
      console.log('🔔 Starting ringtone for incoming call from:', caller.username);
      
      // Try to play ringtone (fallback to system sound)
      audio = new Audio('/ringtone.mp3');
      audio.loop = true;
      audio.volume = 0.7;
      
      // Handle audio play promise
      const playAudio = async () => {
        try {
          await audio!.play();
          console.log('🔔 Ringtone playing');
        } catch (error) {
          console.warn('⚠️ Could not play ringtone:', error);
          // Fallback: try to create a beep sound
          try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            gainNode.gain.value = 0.1;
            
            oscillator.start();
            setTimeout(() => oscillator.stop(), 200);
          } catch (beepError) {
            console.warn('⚠️ Could not create beep sound:', beepError);
          }
        }
      };
      
      playAudio();

      // Auto-reject after 30 seconds
      const timeout = setTimeout(() => {
        console.log('⏰ Auto-rejecting call after 30 seconds');
        onReject();
      }, 30000);
      setRingingTimeout(timeout);
    }

    return () => {
      if (audio) {
        audio.pause();
        audio.src = '';
        console.log('🔇 Stopped ringtone');
      }
      if (ringingTimeout) {
        clearTimeout(ringingTimeout);
      }
    };
  }, [open, caller, onReject]);

  const handleAccept = () => {
    console.log('✅ Accepting call from:', caller?.username);
    if (ringingTimeout) {
      clearTimeout(ringingTimeout);
      setRingingTimeout(null);
    }
    emit('call-accepted', { to: caller?._id, type });
    onAccept();
  };

  const handleReject = () => {
    console.log('❌ Rejecting call from:', caller?.username);
    if (ringingTimeout) {
      clearTimeout(ringingTimeout);
      setRingingTimeout(null);
    }
    emit('call-rejected', { to: caller?._id });
    onReject();
  };

  if (!open || !caller || !type) return null;

  return (
    <Dialog
      open={open}
      TransitionComponent={Transition}
      keepMounted
      maxWidth="sm"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          background: 'linear-gradient(145deg, #1e3a8a, #3b82f6)',
          color: 'white',
          borderRadius: 4,
          overflow: 'hidden',
        },
      }}
    >
      <Box
        sx={{
          p: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          minHeight: 300,
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.1)',
        }}
      >
        {/* Animated Avatar */}
        <Box
          sx={{
            position: 'relative',
            mb: 3,
            '&::before': {
              content: '""',
              position: 'absolute',
              top: -10,
              left: -10,
              right: -10,
              bottom: -10,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.3)',
              animation: 'pulse 2s infinite',
            },
            '@keyframes pulse': {
              '0%': {
                transform: 'scale(1)',
                opacity: 1,
              },
              '50%': {
                transform: 'scale(1.1)',
                opacity: 0.7,
              },
              '100%': {
                transform: 'scale(1)',
                opacity: 1,
              },
            },
          }}
        >
          <Avatar
            src={caller.profilePicture}
            sx={{
              width: 120,
              height: 120,
              fontSize: '3rem',
              bgcolor: 'rgba(255,255,255,0.2)',
            }}
          >
            {caller.username.charAt(0).toUpperCase()}
          </Avatar>
        </Box>

        {/* Caller Info */}
        <Typography variant="h4" gutterBottom fontWeight="bold">
          {caller.username}
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          {type === 'video' ? (
            <Videocam sx={{ color: 'rgba(255,255,255,0.8)' }} />
          ) : (
            <Call sx={{ color: 'rgba(255,255,255,0.8)' }} />
          )}
          <Typography variant="h6" color="rgba(255,255,255,0.9)">
            Incoming {type} call
          </Typography>
        </Box>

        <Typography variant="body2" color="rgba(255,255,255,0.7)" gutterBottom>
          {caller.email}
        </Typography>

        {/* Call Actions */}
        <Box
          sx={{
            display: 'flex',
            gap: 4,
            mt: 4,
            justifyContent: 'center',
          }}
        >
          {/* Reject Button */}
          <Paper
            elevation={3}
            sx={{
              borderRadius: '50%',
              bgcolor: '#ef4444',
              '&:hover': { bgcolor: '#dc2626', transform: 'scale(1.05)' },
              transition: 'all 0.2s',
              cursor: 'pointer',
            }}
            onClick={handleReject}
          >
            <IconButton
              size="large"
              sx={{
                color: 'white',
                p: 2.5,
                fontSize: '2rem',
              }}
            >
              <CallEnd fontSize="large" />
            </IconButton>
          </Paper>

          {/* Accept Button */}
          <Paper
            elevation={3}
            sx={{
              borderRadius: '50%',
              bgcolor: '#10b981',
              '&:hover': { bgcolor: '#059669', transform: 'scale(1.05)' },
              transition: 'all 0.2s',
              cursor: 'pointer',
            }}
            onClick={handleAccept}
          >
            <IconButton
              size="large"
              sx={{
                color: 'white',
                p: 2.5,
                fontSize: '2rem',
              }}
            >
              {type === 'video' ? (
                <Videocam fontSize="large" />
              ) : (
                <Call fontSize="large" />
              )}
            </IconButton>
          </Paper>
        </Box>

        {/* Auto-reject timer */}
        <Typography
          variant="caption"
          sx={{
            mt: 3,
            color: 'rgba(255,255,255,0.6)',
            animation: 'blink 1s infinite',
            '@keyframes blink': {
              '0%': { opacity: 1 },
              '50%': { opacity: 0.5 },
              '100%': { opacity: 1 },
            },
          }}
        >
          Call will be rejected automatically in 30 seconds
        </Typography>
      </Box>
    </Dialog>
  );
};

export default CallNotification;