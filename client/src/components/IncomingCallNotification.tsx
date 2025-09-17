import React, { useState, useEffect } from 'react';
import {
  Dialog,
  Box,
  Avatar,
  Typography,
  IconButton,
  Fade,
  Stack,
  Paper
} from '@mui/material';
import {
  Call as CallIcon,
  CallEnd as CallEndIcon,
  VideoCall as VideoCallIcon,
  Vibration as VibrationIcon
} from '@mui/icons-material';
import { keyframes } from '@mui/system';

interface User {
  _id: string;
  username: string;
  email: string;
  profilePicture?: string;
}

interface IncomingCallNotificationProps {
  open: boolean;
  caller: User | null;
  callType: 'audio' | 'video';
  onAccept: () => void;
  onReject: () => void;
  duration?: number; // Auto-reject after this many seconds
}

// Animations for WhatsApp-like effects
const pulse = keyframes`
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.7;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
`;

const ripple = keyframes`
  0% {
    transform: scale(1);
    opacity: 1;
  }
  100% {
    transform: scale(2.5);
    opacity: 0;
  }
`;

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
  20%, 40%, 60%, 80% { transform: translateX(2px); }
`;

const IncomingCallNotification: React.FC<IncomingCallNotificationProps> = ({
  open,
  caller,
  callType,
  onAccept,
  onReject,
  duration = 30 // Auto-reject after 30 seconds
}) => {
  const [callDuration, setCallDuration] = useState(0);
  const [isVibrating, setIsVibrating] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    let timeoutId: NodeJS.Timeout;
    
    if (open) {
      // Start call duration timer
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);

      // Auto-reject after specified duration
      if (duration > 0) {
        timeoutId = setTimeout(() => {
          console.log('📞 Call auto-rejected after timeout');
          onReject();
        }, duration * 1000);
      }

      // Simulate vibration effect
      setIsVibrating(true);
      
      // Play ringtone (if available)
      if ('mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices) {
        // Could add ringtone audio here
        console.log('🔊 Incoming call ringtone would play here');
      }

      // Browser vibration API if supported
      if ('vibrate' in navigator) {
        const vibratePattern = [200, 100, 200, 100, 200];
        const vibrateInterval = setInterval(() => {
          navigator.vibrate(vibratePattern);
        }, 2000);

        return () => {
          clearInterval(vibrateInterval);
          navigator.vibrate(0); // Stop vibration
        };
      }
    } else {
      setCallDuration(0);
      setIsVibrating(false);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [open, duration, onReject]);

  const formatCallDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!caller) return null;

  return (
    <Dialog
      open={open}
      fullScreen
      PaperProps={{
        sx: {
          background: callType === 'video' 
            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: 'white',
          overflow: 'hidden',
          position: 'relative'
        }
      }}
    >
      {/* Background Pattern */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `radial-gradient(circle at 20% 20%, rgba(255,255,255,0.1) 0%, transparent 50%),
                           radial-gradient(circle at 80% 80%, rgba(255,255,255,0.1) 0%, transparent 50%),
                           radial-gradient(circle at 40% 60%, rgba(255,255,255,0.05) 0%, transparent 50%)`,
          animation: `${pulse} 3s ease-in-out infinite`
        }}
      />

      {/* Top Section - Call Info */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          zIndex: 1,
          p: 4
        }}
      >
        <Fade in={open} timeout={500}>
          <Box>
            <Typography
              variant="h6"
              sx={{
                mb: 1,
                opacity: 0.9,
                fontWeight: 300,
                letterSpacing: 1
              }}
            >
              Incoming {callType} call
            </Typography>

            {/* Caller Avatar with Ripple Effect */}
            <Box
              sx={{
                position: 'relative',
                display: 'inline-block',
                mb: 3,
                animation: isVibrating ? `${shake} 0.5s ease-in-out infinite` : 'none'
              }}
            >
              {/* Ripple Effects */}
              {[1, 2, 3].map((index) => (
                <Box
                  key={index}
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: 160,
                    height: 160,
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderRadius: '50%',
                    transform: 'translate(-50%, -50%)',
                    animation: `${ripple} 2s ease-out infinite`,
                    animationDelay: `${index * 0.5}s`
                  }}
                />
              ))}
              
              <Avatar
                src={caller.profilePicture}
                sx={{
                  width: 160,
                  height: 160,
                  border: '4px solid rgba(255,255,255,0.8)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                  fontSize: '3rem',
                  fontWeight: 'bold',
                  position: 'relative',
                  zIndex: 2
                }}
              >
                {caller.username.charAt(0).toUpperCase()}
              </Avatar>
            </Box>

            <Typography
              variant="h3"
              sx={{
                mb: 1,
                fontWeight: 'bold',
                textShadow: '0 2px 10px rgba(0,0,0,0.3)'
              }}
            >
              {caller.username}
            </Typography>

            <Typography
              variant="h6"
              sx={{
                opacity: 0.8,
                fontWeight: 300
              }}
            >
              {callType === 'video' ? 'WhatsApp Video Call' : 'WhatsApp Voice Call'}
            </Typography>

            <Typography
              variant="body1"
              sx={{
                mt: 2,
                opacity: 0.7,
                fontFamily: 'monospace'
              }}
            >
              {formatCallDuration(callDuration)}
            </Typography>
          </Box>
        </Fade>
      </Box>

      {/* Bottom Section - Call Actions */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          width: '100%',
          maxWidth: 400,
          p: 4,
          zIndex: 1
        }}
      >
        {/* Reject Button */}
        <Paper
          elevation={8}
          sx={{
            borderRadius: '50%',
            p: 0,
            bgcolor: '#f44336',
            animation: `${pulse} 2s ease-in-out infinite`
          }}
        >
          <IconButton
            onClick={onReject}
            sx={{
              width: 80,
              height: 80,
              color: 'white',
              '&:hover': {
                bgcolor: 'rgba(244, 67, 54, 0.8)',
                transform: 'scale(1.1)'
              },
              transition: 'all 0.2s ease'
            }}
          >
            <CallEndIcon sx={{ fontSize: 40 }} />
          </IconButton>
        </Paper>

        {/* Vibration Indicator */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            opacity: 0.7
          }}
        >
          <VibrationIcon
            sx={{
              animation: `${shake} 0.3s ease-in-out infinite`,
              mb: 1
            }}
          />
          <Typography variant="caption">
            Ringing...
          </Typography>
        </Box>

        {/* Accept Button */}
        <Paper
          elevation={8}
          sx={{
            borderRadius: '50%',
            p: 0,
            bgcolor: '#4caf50',
            animation: `${pulse} 2s ease-in-out infinite`
          }}
        >
          <IconButton
            onClick={onAccept}
            sx={{
              width: 80,
              height: 80,
              color: 'white',
              '&:hover': {
                bgcolor: 'rgba(76, 175, 80, 0.8)',
                transform: 'scale(1.1)'
              },
              transition: 'all 0.2s ease'
            }}
          >
            {callType === 'video' ? (
              <VideoCallIcon sx={{ fontSize: 40 }} />
            ) : (
              <CallIcon sx={{ fontSize: 40 }} />
            )}
          </IconButton>
        </Paper>
      </Box>

      {/* Quick Actions Bar (Optional) */}
      <Box
        sx={{
          position: 'absolute',
          top: 60,
          right: 20,
          display: 'flex',
          gap: 1,
          zIndex: 1
        }}
      >
        <Typography
          variant="caption"
          sx={{
            bgcolor: 'rgba(0,0,0,0.3)',
            px: 2,
            py: 1,
            borderRadius: 20,
            backdropFilter: 'blur(10px)'
          }}
        >
          Swipe to answer
        </Typography>
      </Box>
    </Dialog>
  );
};

export default IncomingCallNotification;