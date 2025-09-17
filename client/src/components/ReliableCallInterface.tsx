import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  Box,
  IconButton,
  Typography,
  Avatar,
  Paper,
  Fade,
} from '@mui/material';
import {
  Call,
  CallEnd,
  Mic,
  MicOff,
  Videocam,
  VideocamOff,
} from '@mui/icons-material';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

interface ReliableCallInterfaceProps {
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

const ReliableCallInterface: React.FC<ReliableCallInterfaceProps> = ({
  open,
  type,
  user,
  isIncoming = false,
  onEnd,
  onAccept,
  onReject,
}) => {
  const { socket } = useSocket();
  const { user: currentUser } = useAuth();
  
  // Simple state management
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'ringing'>('connecting');
  
  // Media refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // WebRTC Configuration - Simple and reliable
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };

  // Initialize media and WebRTC when dialog opens
  useEffect(() => {
    if (open && currentUser) {
      console.log('🎥 RELIABLE: Initializing call interface');
      initializeCall();
    }

    return () => {
      cleanup();
    };
  }, [open]);

  // Call duration timer
  useEffect(() => {
    if (isConnected) {
      durationIntervalRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [isConnected]);

  const initializeCall = async () => {
    try {
      console.log('🚀 RELIABLE: Getting user media...');
      
      // Get user media with simple constraints
      const constraints = {
        video: type === 'video' ? { width: 640, height: 480 } : false,
        audio: true
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      console.log('✅ RELIABLE: Got local stream:', {
        video: stream.getVideoTracks().length,
        audio: stream.getAudioTracks().length
      });

      // Set up local video
      if (localVideoRef.current && type === 'video') {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(e => console.warn('Local video play error:', e));
      }

      // Create peer connection
      createPeerConnection();

      // Add tracks to peer connection
      stream.getTracks().forEach(track => {
        peerConnectionRef.current?.addTrack(track, stream);
      });

      if (!isIncoming) {
        // Create and send offer
        await createOffer();
      }

      setConnectionStatus('ringing');

    } catch (error) {
      console.error('❌ RELIABLE: Failed to initialize call:', error);
      handleError(error as Error);
    }
  };

  const createPeerConnection = () => {
    console.log('🔧 RELIABLE: Creating peer connection');
    
    peerConnectionRef.current = new RTCPeerConnection(rtcConfig);

    // Handle remote stream
    peerConnectionRef.current.ontrack = (event) => {
      console.log('📹 RELIABLE: Received remote stream');
      remoteStreamRef.current = event.streams[0];
      
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        remoteVideoRef.current.play().catch(e => console.warn('Remote video play error:', e));
      }
      
      setIsConnected(true);
      setConnectionStatus('connected');
    };

    // Handle ICE candidates
    peerConnectionRef.current.onicecandidate = (event) => {
      if (event.candidate && socket && user) {
        console.log('🧊 RELIABLE: Sending ICE candidate');
        socket.emit('webrtc-signal', {
          type: 'ice-candidate',
          candidate: event.candidate,
          to: user._id
        });
      }
    };

    // Handle connection state changes
    peerConnectionRef.current.onconnectionstatechange = () => {
      const state = peerConnectionRef.current?.connectionState;
      console.log('🔄 RELIABLE: Connection state:', state);
      
      if (state === 'connected') {
        setIsConnected(true);
        setConnectionStatus('connected');
      } else if (state === 'disconnected' || state === 'failed') {
        handleCallEnd();
      }
    };

    // Set up socket listeners for WebRTC signaling
    if (socket) {
      socket.on('webrtc-signal', handleWebRTCSignal);
    }
  };

  const createOffer = async () => {
    if (!peerConnectionRef.current || !socket || !user) return;

    try {
      console.log('📞 RELIABLE: Creating offer');
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);

      socket.emit('webrtc-signal', {
        type: 'offer',
        offer: offer,
        to: user._id
      });

      console.log('📤 RELIABLE: Offer sent');
    } catch (error) {
      console.error('❌ RELIABLE: Failed to create offer:', error);
    }
  };

  const handleWebRTCSignal = async (data: any) => {
    if (!peerConnectionRef.current) return;

    try {
      console.log('📡 RELIABLE: Handling WebRTC signal:', data.type);

      switch (data.type) {
        case 'offer':
          await peerConnectionRef.current.setRemoteDescription(data.offer);
          const answer = await peerConnectionRef.current.createAnswer();
          await peerConnectionRef.current.setLocalDescription(answer);
          
          if (socket && user) {
            socket.emit('webrtc-signal', {
              type: 'answer',
              answer: answer,
              to: user._id
            });
          }
          break;

        case 'answer':
          await peerConnectionRef.current.setRemoteDescription(data.answer);
          break;

        case 'ice-candidate':
          await peerConnectionRef.current.addIceCandidate(data.candidate);
          break;
      }
    } catch (error) {
      console.error('❌ RELIABLE: Error handling WebRTC signal:', error);
    }
  };

  const handleAccept = async () => {
    console.log('✅ RELIABLE: Accepting call');
    setConnectionStatus('connecting');
    onAccept?.();
  };

  const handleReject = () => {
    console.log('❌ RELIABLE: Rejecting call');
    cleanup();
    onReject?.();
  };

  const handleCallEnd = () => {
    console.log('📞 RELIABLE: Ending call');
    cleanup();
    onEnd();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        console.log('🎤 RELIABLE: Mute toggled:', !audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current && type === 'video') {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
        console.log('📹 RELIABLE: Video toggled:', !videoTrack.enabled);
      }
    }
  };

  const cleanup = () => {
    console.log('🧹 RELIABLE: Cleaning up call resources');

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Clear video elements
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    // Clear timer
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    // Remove socket listeners
    if (socket) {
      socket.off('webrtc-signal', handleWebRTCSignal);
    }

    // Reset state
    setIsConnected(false);
    setCallDuration(0);
    setConnectionStatus('connecting');
    setIsMuted(false);
    setIsVideoOff(false);
  };

  const handleError = (error: Error) => {
    console.error('❌ RELIABLE: Call error:', error);
    
    let message = 'Call failed. Please try again.';
    if (error.name === 'NotAllowedError') {
      message = 'Camera/microphone access denied. Please enable permissions and try again.';
    } else if (error.name === 'NotFoundError') {
      message = 'No camera/microphone found. Please check your devices.';
    }
    
    alert(message);
    handleCallEnd();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!open || !user) return null;

  return (
    <Dialog
      open={open}
      fullScreen
      PaperProps={{
        sx: {
          bgcolor: 'black',
          color: 'white',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      {/* Status Bar */}
      <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'rgba(0,0,0,0.8)' }}>
        <Typography variant="h6">{user.username}</Typography>
        <Typography variant="body2" color="rgba(255,255,255,0.8)">
          {connectionStatus === 'ringing' ? 'Ringing...' : 
           connectionStatus === 'connecting' ? 'Connecting...' :
           connectionStatus === 'connected' ? formatDuration(callDuration) : 'Call'}
        </Typography>
      </Box>

      {/* Video Area */}
      <Box sx={{ flex: 1, position: 'relative', bgcolor: '#333' }}>
        {type === 'video' ? (
          <>
            {/* Remote Video (Full Screen) */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                backgroundColor: '#000',
                display: remoteStreamRef.current ? 'block' : 'none'
              }}
            />

            {/* Local Video (Picture in Picture) */}
            <Box
              sx={{
                position: 'absolute',
                top: 20,
                right: 20,
                width: 150,
                height: 100,
                borderRadius: 2,
                overflow: 'hidden',
                border: '2px solid white',
                bgcolor: '#000'
              }}
            >
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
                  display: isVideoOff ? 'none' : 'block'
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
                  <Avatar sx={{ width: 40, height: 40 }}>
                    {currentUser?.username?.charAt(0).toUpperCase()}
                  </Avatar>
                </Box>
              )}
            </Box>

            {/* Placeholder when no remote video */}
            {!remoteStreamRef.current && (
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                height: '100%',
                flexDirection: 'column'
              }}>
                <Avatar sx={{ width: 120, height: 120, mb: 2 }}>
                  {user.username.charAt(0).toUpperCase()}
                </Avatar>
                <Typography variant="h5">{user.username}</Typography>
                <Typography variant="body1" sx={{ mt: 1, opacity: 0.8 }}>
                  {connectionStatus === 'ringing' ? 'Ringing...' : 'Connecting...'}
                </Typography>
              </Box>
            )}
          </>
        ) : (
          /* Audio Only View */
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: '100%',
            flexDirection: 'column'
          }}>
            <Avatar sx={{ width: 120, height: 120, mb: 2 }}>
              {user.username.charAt(0).toUpperCase()}
            </Avatar>
            <Typography variant="h5">{user.username}</Typography>
            <Typography variant="body1" sx={{ mt: 1, opacity: 0.8 }}>
              🎤 Audio Call
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, opacity: 0.6 }}>
              {connectionStatus === 'ringing' ? 'Ringing...' : 
               connectionStatus === 'connecting' ? 'Connecting...' :
               connectionStatus === 'connected' ? formatDuration(callDuration) : ''}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Call Controls */}
      <Box sx={{ 
        p: 3, 
        display: 'flex', 
        justifyContent: 'center', 
        gap: 3,
        bgcolor: 'rgba(0,0,0,0.9)'
      }}>
        {isIncoming && connectionStatus === 'ringing' ? (
          /* Incoming Call Controls */
          <>
            <IconButton
              onClick={handleReject}
              sx={{
                width: 70,
                height: 70,
                bgcolor: '#f44336',
                color: 'white',
                '&:hover': { bgcolor: '#d32f2f' }
              }}
            >
              <CallEnd sx={{ fontSize: 32 }} />
            </IconButton>

            <IconButton
              onClick={handleAccept}
              sx={{
                width: 70,
                height: 70,
                bgcolor: '#4caf50',
                color: 'white',
                '&:hover': { bgcolor: '#388e3c' }
              }}
            >
              {type === 'video' ? <Videocam sx={{ fontSize: 32 }} /> : <Call sx={{ fontSize: 32 }} />}
            </IconButton>
          </>
        ) : (
          /* In-Call Controls */
          <>
            <IconButton
              onClick={toggleMute}
              sx={{
                width: 60,
                height: 60,
                bgcolor: isMuted ? '#f44336' : 'rgba(255,255,255,0.2)',
                color: 'white',
                '&:hover': { 
                  bgcolor: isMuted ? '#d32f2f' : 'rgba(255,255,255,0.3)' 
                }
              }}
            >
              {isMuted ? <MicOff /> : <Mic />}
            </IconButton>

            {type === 'video' && (
              <IconButton
                onClick={toggleVideo}
                sx={{
                  width: 60,
                  height: 60,
                  bgcolor: isVideoOff ? '#f44336' : 'rgba(255,255,255,0.2)',
                  color: 'white',
                  '&:hover': { 
                    bgcolor: isVideoOff ? '#d32f2f' : 'rgba(255,255,255,0.3)' 
                  }
                }}
              >
                {isVideoOff ? <VideocamOff /> : <Videocam />}
              </IconButton>
            )}

            <IconButton
              onClick={handleCallEnd}
              sx={{
                width: 60,
                height: 60,
                bgcolor: '#f44336',
                color: 'white',
                '&:hover': { bgcolor: '#d32f2f' }
              }}
            >
              <CallEnd />
            </IconButton>
          </>
        )}
      </Box>
    </Dialog>
  );
};

export default ReliableCallInterface;