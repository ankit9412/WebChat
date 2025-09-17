import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  IconButton,
  Typography,
  Paper,
  Avatar,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
} from '@mui/material';
import {
  Call,
  CallEnd,
  Mic,
  MicOff,
  Videocam,
  VideocamOff,
  VolumeUp,
  VolumeOff,
  Fullscreen,
  FullscreenExit,
  VideoCall as VideoCallIcon,
} from '@mui/icons-material';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { WebRTCService } from '../services/webrtc';

interface CallInterfaceProps {
  open: boolean;
  type: 'audio' | 'video';
  user: {
    _id: string;
    username: string;
    profilePicture?: string;
  } | null;
  isIncoming?: boolean;
  onEnd: () => void;
  onAccept?: () => void;
  onReject?: () => void;
}

const CallInterface: React.FC<CallInterfaceProps> = ({
  open,
  type,
  user,
  isIncoming = false,
  onEnd,
  onAccept,
  onReject,
}) => {
  const { socket, emit } = useSocket();
  const { user: currentUser } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerOff, setIsSpeakerOff] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isRinging, setIsRinging] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'failed'>('connecting');
  const [callQuality, setCallQuality] = useState<{ audio: string; video: string }>({ audio: 'good', video: 'good' });
  const [networkStats, setNetworkStats] = useState<{ bitrate: number; packetLoss: number }>({ bitrate: 0, packetLoss: 0 });
  const [hasRemoteStream, setHasRemoteStream] = useState(false);
  const [hasLocalStream, setHasLocalStream] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const webrtcServiceRef = useRef<WebRTCService | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  // Helper function to setup local video immediately
  const setupLocalVideo = async () => {
    try {
      console.log('🎥 Setting up local video immediately...');
      const localMedia = await navigator.mediaDevices.getUserMedia({
        video: type === 'video',
        audio: true,
      });
      
      console.log('✅ Got local media:', {
        video: localMedia.getVideoTracks().length,
        audio: localMedia.getAudioTracks().length,
        streamId: localMedia.id
      });
      
      // Store the stream
      localStreamRef.current = localMedia;
      setHasLocalStream(true);
      
      // Set up local video element immediately
      if (localVideoRef.current && type === 'video') {
        localVideoRef.current.srcObject = localMedia;
        console.log('🎥 Local video element srcObject set');
        
        // Force play and handle any errors
        try {
          await localVideoRef.current.play();
          console.log('✅ Local video playing successfully');
        } catch (playError) {
          console.warn('⚠️ Local video play failed, trying again...', playError);
          // Try again after a short delay
          setTimeout(() => {
            if (localVideoRef.current) {
              localVideoRef.current.play().catch(e => console.warn('Local video play retry failed:', e));
            }
          }, 500);
        }
      }
      
      return localMedia;
    } catch (error) {
      console.error('❌ Failed to get local media:', error);
      throw error;
    }
  };

  useEffect(() => {
    if (open && socket && currentUser) {
      console.log('🎥 CallInterface opened, initializing WebRTC...');
      
      // Initialize WebRTC service
      webrtcServiceRef.current = new WebRTCService(socket, currentUser.id);
      
      // Set up event listeners
      webrtcServiceRef.current.on('localStream', (stream: MediaStream) => {
        console.log('🎥 LOCAL STREAM RECEIVED:', stream.id);
        localStreamRef.current = stream;
        setHasLocalStream(true);
        
        // Set local video immediately
        if (localVideoRef.current && type === 'video') {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(e => console.warn('Local video play error:', e));
          console.log('✅ LOCAL VIDEO SET AND PLAYING');
        }
      });
      
      webrtcServiceRef.current.on('remoteStream', (stream: MediaStream) => {
        console.log('📹 REMOTE STREAM RECEIVED:', {
          streamId: stream.id,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
          videoTrackEnabled: stream.getVideoTracks()[0]?.enabled,
          active: stream.active
        });
        
        remoteStreamRef.current = stream;
        setHasRemoteStream(true);
        
        // Set remote video immediately with enhanced debugging
        if (remoteVideoRef.current) {
          console.log('📺 Setting remote video srcObject...');
          remoteVideoRef.current.srcObject = stream;
          
          // Add event listeners before playing
          remoteVideoRef.current.onloadedmetadata = () => {
            console.log('📺 Remote video metadata loaded:', {
              videoWidth: remoteVideoRef.current?.videoWidth,
              videoHeight: remoteVideoRef.current?.videoHeight,
              elementWidth: remoteVideoRef.current?.clientWidth,
              elementHeight: remoteVideoRef.current?.clientHeight
            });
          };
          
          remoteVideoRef.current.oncanplay = () => {
            console.log('✅ Remote video can play');
          };
          
          remoteVideoRef.current.onplay = () => {
            console.log('▶️ Remote video started playing');
          };
          
          remoteVideoRef.current.onerror = (e) => {
            console.error('❌ Remote video error:', e);
          };
          
          // Try to play the video
          remoteVideoRef.current.play()
            .then(() => {
              console.log('✅ REMOTE VIDEO SET AND PLAYING SUCCESSFULLY');
            })
            .catch(e => {
              console.warn('⚠️ Remote video play error, retrying...', e);
              // Retry after a short delay
              setTimeout(() => {
                if (remoteVideoRef.current && remoteStreamRef.current) {
                  remoteVideoRef.current.play().catch(retryError => {
                    console.error('❌ Remote video play retry failed:', retryError);
                  });
                }
              }, 500);
            });
        } else {
          console.error('❌ Remote video ref is null!');
        }
        
        setIsConnected(true);
        setIsRinging(false);
        setConnectionStatus('connected');
      });
      
      // Start or prepare for call
      if (!isIncoming) {
        startCall();
      }
    }
    
    return () => {
      // Cleanup WebRTC service and event listeners
      if (webrtcServiceRef.current) {
        webrtcServiceRef.current.off('remoteStream');
        webrtcServiceRef.current.off('localStream');
        webrtcServiceRef.current.off('connectionStateChange');
        webrtcServiceRef.current.off('incomingOffer');
        webrtcServiceRef.current.endCall();
        webrtcServiceRef.current = null;
      }
    };
  }, [open, isIncoming, socket]);

  // Handle window resize for responsive video display
  useEffect(() => {
    const handleResize = () => {
      const newSize = { width: window.innerWidth, height: window.innerHeight };
      setWindowSize(newSize);
      console.log('📺 Screen size changed:', newSize);
      
      // Force video refresh on resize if we have remote stream
      if (hasRemoteStream && remoteVideoRef.current && remoteStreamRef.current) {
        console.log('🔄 Refreshing remote video after resize');
        // Force video element to refresh
        const currentSrc = remoteVideoRef.current.srcObject;
        remoteVideoRef.current.srcObject = null;
        setTimeout(() => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = currentSrc;
          }
        }, 100);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [hasRemoteStream]);

  useEffect(() => {
    if (isConnected && !isRinging) {
      durationIntervalRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [isConnected, isRinging]);

  const startCall = async () => {
    if (!user || !currentUser || !webrtcServiceRef.current) {
      console.error('❌ Missing required data for call');
      onEnd();
      return;
    }
    
    try {
      console.log('🚀 STARTING CALL:', user.username);
      setIsRinging(true);
      setConnectionStatus('connecting');
      
      // Start the call - WebRTC service will handle everything
      await webrtcServiceRef.current.startCall(user._id, type);
      
      console.log('✅ Call started successfully');
    } catch (error: any) {
      console.error('❌ Call start failed:', error);
      // Handle permission errors gracefully
      if (error.name === 'NotAllowedError') {
        alert('Camera/microphone access denied. Please enable permissions and try again.');
      } else if (error.name === 'NotFoundError') {
        alert('No camera/microphone found. Please check your devices.');
      } else {
        alert('Failed to start call: ' + error.message);
      }
      onEnd();
    }
  };

  const handleAccept = async () => {
    if (!user || !currentUser || !webrtcServiceRef.current) {
      console.error('❌ Missing required data for call accept');
      handleReject();
      return;
    }
    
    try {
      console.log('✅ ACCEPTING CALL from:', user.username);
      setIsRinging(false);
      setConnectionStatus('connecting');
      
      // Answer the call - WebRTC service will handle everything
      await webrtcServiceRef.current.answerCall(user._id, type);
      
      console.log('✅ Call accepted successfully');
      onAccept?.();
    } catch (error) {
      console.error('❌ Call accept failed:', error);
      alert('Failed to accept call: ' + (error as Error).message);
      handleReject();
    }
  };

  const handleReject = () => {
    onReject?.();
    onEnd();
  };

  const handleEnd = () => {
    console.log('📞 Ending call...');
    
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('🚫 Stopped track:', track.kind);
      });
      localStreamRef.current = null;
    }
    
    // Clean up video elements
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    
    // End WebRTC call
    if (webrtcServiceRef.current) {
      webrtcServiceRef.current.endCall();
    }
    
    // Clear duration timer
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    
    // Emit call ended event
    if (socket && user) {
      emit('call-ended', { to: user._id });
    }
    
    // Reset state
    setIsConnected(false);
    setIsRinging(false);
    setCallDuration(0);
    setHasRemoteStream(false);
    setHasLocalStream(false);
    
    // Clear stream refs
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    
    onEnd();
  };

  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    
    console.log('🎤 Toggling mute:', newMutedState);
    
    // Mute/unmute the audio track
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !newMutedState;
        console.log('🎤 Audio track enabled:', track.enabled);
      });
    }
    
    // Use WebRTC service if available
    if (webrtcServiceRef.current) {
      webrtcServiceRef.current.toggleMute();
    }
  };

  const toggleVideo = () => {
    const newVideoOffState = !isVideoOff;
    setIsVideoOff(newVideoOffState);
    
    console.log('📹 Toggling video:', newVideoOffState);
    
    // Enable/disable the video track
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !newVideoOffState;
        console.log('📹 Video track enabled:', track.enabled);
      });
    }
    
    // Use WebRTC service if available
    if (webrtcServiceRef.current) {
      webrtcServiceRef.current.toggleVideo();
    }
  };

  const toggleSpeaker = () => {
    setIsSpeakerOff(!isSpeakerOff);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Debug effect to monitor local stream
  useEffect(() => {
    if (hasLocalStream && localStreamRef.current && localVideoRef.current && type === 'video') {
      console.log('🔍 Checking local video setup:', {
        hasLocalStream,
        localStreamExists: !!localStreamRef.current,
        localVideoRefExists: !!localVideoRef.current,
        srcObjectSet: !!localVideoRef.current.srcObject,
        videoTracks: localStreamRef.current.getVideoTracks().length,
        audioTracks: localStreamRef.current.getAudioTracks().length,
        videoEnabled: localStreamRef.current.getVideoTracks()[0]?.enabled
      });
      
      // Ensure srcObject is set
      if (!localVideoRef.current.srcObject && localStreamRef.current) {
        console.log('🔧 Fixing local video srcObject...');
        localVideoRef.current.srcObject = localStreamRef.current;
        localVideoRef.current.play().catch(e => console.warn('Local video play failed:', e));
      }
    }
  }, [hasLocalStream, type]);

  // Debug logging removed

  if (!open) return null;

  return (
    <Dialog
      open={open}
      fullScreen
      sx={{
        '& .MuiDialog-paper': {
          bgcolor: 'black',
          color: 'white',
        },
      }}
    >
      <Box
        sx={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Remote Video */}
        <Box
          sx={{
            flex: 1,
            position: 'relative',
            bgcolor: '#333',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '400px', // Ensure minimum height
            overflow: 'hidden', // Prevent content from going outside
            width: '100%'
          }}
        >
          {type === 'video' ? (
            <>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                muted={false}
                controls={false}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  // Use 'contain' on large screens to ensure video is always visible
                  objectFit: windowSize.width > 768 ? 'contain' : 'cover',
                  display: hasRemoteStream ? 'block' : 'none',
                  backgroundColor: '#000',
                  zIndex: 1,
                  // Add border for debugging on large screens
                  border: windowSize.width > 768 ? '2px solid red' : 'none'
                }}
                onLoadedMetadata={() => {
                  console.log('📹 Remote video metadata loaded:', {
                    videoWidth: remoteVideoRef.current?.videoWidth,
                    videoHeight: remoteVideoRef.current?.videoHeight,
                    elementWidth: remoteVideoRef.current?.clientWidth,
                    elementHeight: remoteVideoRef.current?.clientHeight,
                    windowSize: { width: window.innerWidth, height: window.innerHeight }
                  });
                }}
                onCanPlay={() => {
                  console.log('📹 Remote video can play');
                }}
                onError={(e) => {
                  console.error('❌ Remote video error:', e);
                }}
              />
              {/* Show placeholder when no remote stream yet */}
              {!hasRemoteStream && (
                <Box sx={{ 
                  textAlign: 'center',
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 2
                }}>
                  <Avatar
                    src={user?.profilePicture}
                    sx={{ width: 120, height: 120, mx: 'auto', mb: 2 }}
                  >
                    {user?.username?.charAt(0).toUpperCase()}
                  </Avatar>
                  <Typography variant="h4" gutterBottom>
                    {user?.username}
                  </Typography>
                  <Typography variant="h6" color="text.secondary">
                    {isRinging ? 'Ringing...' : isConnected ? 'Video connecting...' : 'Connecting...'}
                  </Typography>
                </Box>
              )}
            </>
          ) : (
            <Box sx={{ textAlign: 'center' }}>
              <Avatar
                src={user?.profilePicture}
                sx={{ width: 120, height: 120, mx: 'auto', mb: 2 }}
              >
                {user?.username?.charAt(0).toUpperCase()}
              </Avatar>
              <Typography variant="h4" gutterBottom>
                {user?.username}
              </Typography>
              <Typography variant="h6" color="text.secondary">
                {isRinging ? 'Ringing...' : 'Connected'}
              </Typography>
            </Box>
          )}

          {/* Local Video (Picture-in-Picture) */}
          {type === 'video' && (
            <Box
              sx={{
                position: 'absolute',
                top: 20,
                right: 20,
                width: 150,
                height: 100,
                borderRadius: 2,
                overflow: 'hidden',
                border: 2,
                borderColor: 'white',
                bgcolor: isVideoOff ? 'rgba(0,0,0,0.8)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {hasLocalStream ? (
                <>
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transform: 'scaleX(-1)', // Mirror effect
                      display: isVideoOff ? 'none' : 'block',
                      background: '#000'
                    }}
                    onLoadedMetadata={() => {
                      console.log('🎥 Local video metadata loaded, dimensions:', {
                        width: localVideoRef.current?.videoWidth,
                        height: localVideoRef.current?.videoHeight,
                        srcObject: !!localVideoRef.current?.srcObject
                      });
                    }}
                    onCanPlay={() => {
                      console.log('✅ Local video can play');
                    }}
                    onPlay={() => {
                      console.log('▶️ Local video started playing');
                    }}
                    onError={(e) => {
                      console.error('❌ Local video error:', e);
                    }}
                  />
                  {isVideoOff && (
                    <Box sx={{ 
                      position: 'absolute', 
                      top: 0, 
                      left: 0, 
                      width: '100%', 
                      height: '100%', 
                      bgcolor: 'rgba(0,0,0,0.8)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center' 
                    }}>
                      <Avatar
                        src={currentUser?.profilePicture}
                        sx={{ width: 40, height: 40, bgcolor: 'grey.600' }}
                      >
                        {currentUser?.username?.charAt(0).toUpperCase()}
                      </Avatar>
                    </Box>
                  )}
                </>
              ) : (
                <Box sx={{ textAlign: 'center' }}>
                  <Avatar
                    src={currentUser?.profilePicture}
                    sx={{ width: 40, height: 40, bgcolor: 'grey.600', mx: 'auto' }}
                  >
                    {currentUser?.username?.charAt(0).toUpperCase()}
                  </Avatar>
                  {!hasLocalStream && (
                    <Typography variant="caption" sx={{ color: 'white', display: 'block', mt: 1 }}>
                      No Local Stream
                    </Typography>
                  )}
                  {hasLocalStream && isVideoOff && (
                    <Typography variant="caption" sx={{ color: 'white', display: 'block', mt: 1 }}>
                      Video Off
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          )}

          {/* Call Duration & Status */}
          <Box
            sx={{
              position: 'absolute',
              top: 20,
              left: 20,
              bgcolor: 'rgba(0,0,0,0.7)',
              px: 2,
              py: 1,
              borderRadius: 2,
              minWidth: 120,
            }}
          >
            {isConnected && (
              <Typography variant="h6" sx={{ color: 'white', mb: 0.5 }}>
                {formatDuration(callDuration)}
              </Typography>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: 
                    connectionStatus === 'connected' ? '#10b981' :
                    connectionStatus === 'connecting' ? '#f59e0b' :
                    connectionStatus === 'failed' ? '#ef4444' : '#6b7280'
                }}
              />
              <Typography variant="caption" sx={{ color: 'white', textTransform: 'capitalize' }}>
                {connectionStatus === 'connecting' && isRinging ? 'Ringing...' : connectionStatus}
              </Typography>
            </Box>
            {isConnected && networkStats.bitrate > 0 && (
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'block', mt: 0.5 }}>
                {Math.round(networkStats.bitrate / 1000)}kbps
              </Typography>
            )}
          </Box>
        </Box>

        {/* WhatsApp-like Call Controls */}
        <Box
          sx={{
            position: 'fixed',
            bottom: 40,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            zIndex: 10
          }}
        >
          {/* Call Status Info */}
          <Box
            sx={{
              bgcolor: 'rgba(0,0,0,0.8)',
              borderRadius: 25,
              px: 3,
              py: 1,
              backdropFilter: 'blur(15px)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'white',
                fontWeight: 500,
                textAlign: 'center',
                minWidth: 100
              }}
            >
              {isConnected ? `${formatDuration(callDuration)}` : (
                isRinging ? 'Ringing...' : 
                connectionStatus === 'connecting' ? 'Connecting...' :
                connectionStatus === 'connected' ? 'Connected' : 'Disconnected'
              )}
            </Typography>
          </Box>

          {/* Main Controls Container */}
          <Box
            sx={{
              display: 'flex',
              gap: isIncoming && isRinging ? 6 : 3,
              alignItems: 'center',
              bgcolor: 'rgba(0,0,0,0.9)',
              borderRadius: isIncoming && isRinging ? 50 : 35,
              p: isIncoming && isRinging ? 3 : 2,
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
            }}
          >
            {isIncoming && isRinging ? (
              /* Incoming Call Actions */
              <>
                {/* Reject Button */}
                <Box sx={{ position: 'relative' }}>
                  <IconButton
                    onClick={handleReject}
                    sx={{
                      width: 70,
                      height: 70,
                      bgcolor: '#ff4444',
                      color: 'white',
                      '&:hover': {
                        bgcolor: '#cc3333',
                        transform: 'scale(1.1)'
                      },
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        width: '120%',
                        height: '120%',
                        border: '2px solid #ff4444',
                        borderRadius: '50%',
                        animation: 'pulse 2s ease-in-out infinite'
                      },
                      '@keyframes pulse': {
                        '0%': { transform: 'scale(1)', opacity: 1 },
                        '100%': { transform: 'scale(1.5)', opacity: 0 }
                      },
                      transition: 'all 0.2s ease',
                      boxShadow: '0 4px 20px rgba(255, 68, 68, 0.4)'
                    }}
                  >
                    <CallEnd sx={{ fontSize: 32 }} />
                  </IconButton>
                </Box>

                {/* Accept Button */}
                <Box sx={{ position: 'relative' }}>
                  <IconButton
                    onClick={handleAccept}
                    sx={{
                      width: 70,
                      height: 70,
                      bgcolor: '#44ff44',
                      color: 'white',
                      '&:hover': {
                        bgcolor: '#33cc33',
                        transform: 'scale(1.1)'
                      },
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        width: '120%',
                        height: '120%',
                        border: '2px solid #44ff44',
                        borderRadius: '50%',
                        animation: 'pulse 2s ease-in-out infinite 1s'
                      },
                      transition: 'all 0.2s ease',
                      boxShadow: '0 4px 20px rgba(68, 255, 68, 0.4)'
                    }}
                  >
                    {type === 'video' ? <VideoCallIcon sx={{ fontSize: 32 }} /> : <Call sx={{ fontSize: 32 }} />}
                  </IconButton>
                </Box>
              </>
            ) : (
              /* In-Call Controls */
              <>
                {/* Mute Button */}
                <IconButton
                  onClick={toggleMute}
                  sx={{
                    width: 56,
                    height: 56,
                    bgcolor: isMuted ? '#ff4444' : 'rgba(255,255,255,0.15)',
                    color: 'white',
                    border: isMuted ? '2px solid #ff6666' : '2px solid rgba(255,255,255,0.2)',
                    '&:hover': { 
                      bgcolor: isMuted ? '#cc3333' : 'rgba(255,255,255,0.25)',
                      transform: 'scale(1.05)'
                    },
                    transition: 'all 0.2s ease',
                    boxShadow: isMuted ? '0 4px 15px rgba(255, 68, 68, 0.3)' : '0 4px 15px rgba(0,0,0,0.2)'
                  }}
                >
                  {isMuted ? <MicOff sx={{ fontSize: 24 }} /> : <Mic sx={{ fontSize: 24 }} />}
                </IconButton>

                {/* Video Toggle Button (only for video calls) */}
                {type === 'video' && (
                  <IconButton
                    onClick={toggleVideo}
                    sx={{
                      width: 56,
                      height: 56,
                      bgcolor: isVideoOff ? '#ff4444' : 'rgba(255,255,255,0.15)',
                      color: 'white',
                      border: isVideoOff ? '2px solid #ff6666' : '2px solid rgba(255,255,255,0.2)',
                      '&:hover': { 
                        bgcolor: isVideoOff ? '#cc3333' : 'rgba(255,255,255,0.25)',
                        transform: 'scale(1.05)'
                      },
                      transition: 'all 0.2s ease',
                      boxShadow: isVideoOff ? '0 4px 15px rgba(255, 68, 68, 0.3)' : '0 4px 15px rgba(0,0,0,0.2)'
                    }}
                  >
                    {isVideoOff ? <VideocamOff sx={{ fontSize: 24 }} /> : <Videocam sx={{ fontSize: 24 }} />}
                  </IconButton>
                )}

                {/* Speaker Button */}
                <IconButton
                  onClick={toggleSpeaker}
                  sx={{
                    width: 56,
                    height: 56,
                    bgcolor: isSpeakerOff ? '#ff4444' : 'rgba(255,255,255,0.15)',
                    color: 'white',
                    border: isSpeakerOff ? '2px solid #ff6666' : '2px solid rgba(255,255,255,0.2)',
                    '&:hover': { 
                      bgcolor: isSpeakerOff ? '#cc3333' : 'rgba(255,255,255,0.25)',
                      transform: 'scale(1.05)'
                    },
                    transition: 'all 0.2s ease',
                    boxShadow: isSpeakerOff ? '0 4px 15px rgba(255, 68, 68, 0.3)' : '0 4px 15px rgba(0,0,0,0.2)'
                  }}
                >
                  {isSpeakerOff ? <VolumeOff sx={{ fontSize: 24 }} /> : <VolumeUp sx={{ fontSize: 24 }} />}
                </IconButton>

                {/* End Call Button */}
                <IconButton
                  onClick={handleEnd}
                  sx={{
                    width: 56,
                    height: 56,
                    bgcolor: '#ff4444',
                    color: 'white',
                    border: '2px solid #ff6666',
                    '&:hover': {
                      bgcolor: '#cc3333',
                      transform: 'scale(1.05)'
                    },
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 15px rgba(255, 68, 68, 0.4)'
                  }}
                >
                  <CallEnd sx={{ fontSize: 24 }} />
                </IconButton>
              </>
            )}
          </Box>

          {/* Network Quality Indicator */}
          {isConnected && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                bgcolor: 'rgba(0,0,0,0.6)',
                borderRadius: 15,
                px: 2,
                py: 0.5,
                backdropFilter: 'blur(10px)'
              }}
            >
              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'end' }}>
                {[1, 2, 3, 4].map((bar) => (
                  <Box
                    key={bar}
                    sx={{
                      width: 3,
                      height: bar * 2 + 4,
                      bgcolor: bar <= 3 ? '#4caf50' : '#ff9800',
                      borderRadius: 0.5
                    }}
                  />
                ))}
              </Box>
              <Typography 
                variant="caption" 
                sx={{ 
                  color: 'rgba(255,255,255,0.8)', 
                  fontSize: '0.7rem',
                  fontWeight: 500
                }}
              >
                HD
              </Typography>
            </Box>
          )}
        </Box>

        {/* Connection Status */}
        {!isConnected && !isRinging && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 120,
              left: '50%',
              transform: 'translateX(-50%)',
              textAlign: 'center',
            }}
          >
            <LinearProgress sx={{ width: 200, mb: 1 }} />
            <Typography variant="body2">
              Connecting...
            </Typography>
          </Box>
        )}
      </Box>
    </Dialog>
  );
};

export default CallInterface;
