import React, { useState, useRef } from 'react';
import {
  Box,
  Typography,
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  Paper,
  Tooltip,
} from '@mui/material';
import {
  MoreVert,
  Reply,
  Forward,
  Edit,
  Delete,
  ThumbUp,
  ThumbDown,
  Favorite,
  SentimentVerySatisfied,
  SentimentDissatisfied,
  SentimentSatisfied,
  SentimentNeutral,
  PlayArrow,
  Pause,
  VolumeUp,
  Call,
  ThumbUpAlt,
} from '@mui/icons-material';
import moment from 'moment-timezone';
import { messageAPI } from '../services/api';
import AudioUtils from '../utils/audioUtils';
import MessageStatus from './MessageStatus';

interface Message {
  _id: string;
  sender: {
    _id: string;
    username: string;
    profilePicture?: string;
  };
  content: string;
  type: 'text' | 'image' | 'file' | 'voice' | 'video' | 'call' | 'system';
  attachment?: {
    url: string;
    filename: string;
    size: number;
    mimeType: string;
  };
  voiceNote?: {
    url: string;
    duration: number;
    waveform: number[];
  };
  createdAt: string;
  status: 'sent' | 'delivered' | 'read';
  isEdited: boolean;
  editedAt?: string;
  reactions: Array<{
    user: string;
    emoji: string;
    timestamp: string;
  }>;
  replyTo?: Message;
}

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isOwn }) => {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [reactions, setReactions] = useState(message.reactions || []);
  const [isVoicePlaying, setIsVoicePlaying] = useState(false);
  const [voiceProgress, setVoiceProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const formatTime = (timestamp: string) => {
    return moment(timestamp).tz('Asia/Kolkata').format('h:mm A');
  };

  const formatDate = (timestamp: string) => {
    return moment(timestamp).tz('Asia/Kolkata').format('MMM DD, YYYY');
  };


  const handleVoicePlayback = async () => {
    try {
      console.log('🎤 VOICE PLAYBACK ATTEMPT:', {
        messageType: message.type,
        messageContent: message.content,
        attachment: message.attachment,
        voiceNote: message.voiceNote,
        isPlaying: isVoicePlaying
      });
      
      // Try to extract audio URL from different possible sources
      let audioUrl: string | null = null;
      let voiceData: any = null;
      
      // Priority 1: Check if content contains JSON with voice data (for old blob-based messages)
      if (message.content && message.content.includes('audioUrl')) {
        try {
          voiceData = JSON.parse(message.content);
          audioUrl = voiceData.audioUrl;
          console.log('🎤 Extracted audio URL from content:', audioUrl);
        } catch (parseError) {
          console.log('🎤 Content is not JSON, checking other sources');
        }
      }
      
      // Priority 2: Use attachment URL (for server-uploaded voice messages)
      if (!audioUrl && message.attachment?.url) {
        audioUrl = message.attachment.url;
        console.log('🎤 Using attachment audio URL:', audioUrl);
      }
      
      // Priority 3: Use voiceNote URL (fallback)
      if (!audioUrl && message.voiceNote?.url) {
        audioUrl = message.voiceNote.url;
        console.log('🎤 Using voiceNote audio URL:', audioUrl);
      }
      
      if (!audioUrl) {
        console.error('❌ No audio URL found anywhere in message');
        alert('No audio data found for this voice message');
        return;
      }
      
      // Clean up the URL - handle both relative and absolute paths
      if (audioUrl.startsWith('/')) {
        // Relative path from server
        audioUrl = `http://localhost:5001${audioUrl}`;
        console.log('🎤 Converted relative path to absolute:', audioUrl);
      } else if (audioUrl.startsWith('blob:')) {
        // Blob URL - keep as is but warn it might not work
        console.warn('⚠️ Using blob URL - may not work across sessions:', audioUrl);
      } else if (!audioUrl.startsWith('http')) {
        // Other relative paths
        audioUrl = `http://localhost:5001/${audioUrl}`;
        console.log('🎤 Added server prefix to URL:', audioUrl);
      }
      
      // Basic URL validation (skip for blob URLs)
      if (!audioUrl.startsWith('blob:')) {
        try {
          new URL(audioUrl);
          console.log('✅ Audio URL validation passed:', audioUrl);
        } catch (urlError) {
          console.error('❌ Invalid audio URL format:', audioUrl);
          alert('Invalid audio URL format');
          return;
        }
      }
      
      console.log('🎤 Final audio URL:', audioUrl);
      
      // Simple format detection for logging
      let detectedFormat = 'unknown';
      if (audioUrl.includes('.webm')) detectedFormat = 'webm';
      else if (audioUrl.includes('.wav')) detectedFormat = 'wav';
      else if (audioUrl.includes('.mp3')) detectedFormat = 'mp3';
      else if (audioUrl.includes('.m4a')) detectedFormat = 'm4a';
      else if (audioUrl.includes('.ogg')) detectedFormat = 'ogg';
      
      console.log('🎤 Detected format from URL:', detectedFormat);
      
      // Quick accessibility test for WAV files
      console.log('🎤 Attempting to play audio directly...');
      
      // For WAV files, skip complex validation and try direct playback
      if (detectedFormat === 'wav') {
        console.log('🎤 WAV format detected - should work universally');
      }
      
      if (isVoicePlaying && audioRef.current) {
        // Pause the audio
        audioRef.current.pause();
        setIsVoicePlaying(false);
        console.log('⏸️ Audio paused');
      } else {
        // Create and play the audio
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        
        const audio = new Audio();
        audioRef.current = audio;
        
        // Set up event listeners before setting source
        audio.onloadstart = () => console.log('📦 Audio loading started');
        audio.oncanplay = () => console.log('✅ Audio can play');
        audio.onplay = () => {
          console.log('▶️ Audio started playing');
          setIsVoicePlaying(true);
        };
        audio.onpause = () => {
          console.log('⏸️ Audio paused');
          setIsVoicePlaying(false);
        };
        audio.onended = () => {
          console.log('⏹️ Audio ended');
          setIsVoicePlaying(false);
          setVoiceProgress(0);
          // Clean up the audio reference
          if (audioRef.current === audio) {
            audioRef.current = null;
          }
        };
        audio.ontimeupdate = () => {
          if (audio.duration && !isNaN(audio.duration)) {
            const progress = (audio.currentTime / audio.duration) * 100;
            setVoiceProgress(progress);
          }
        };
        audio.onerror = (error) => {
          console.error('❌ Audio playback error:', error);
          console.error('❌ Audio error details:', {
            code: audio.error?.code,
            message: audio.error?.message,
            url: audioUrl,
            audioSrc: audio.src,
            readyState: audio.readyState,
            networkState: audio.networkState
          });
          
          setIsVoicePlaying(false);
          setVoiceProgress(0);
          
          // Clean up the audio reference on error
          if (audioRef.current === audio) {
            audioRef.current = null;
          }
          
          // More detailed error message
          let errorMsg = 'Failed to play voice message.';
          if (audio.error) {
            switch (audio.error.code) {
              case MediaError.MEDIA_ERR_ABORTED:
                errorMsg += ' Playback was aborted.';
                break;
              case MediaError.MEDIA_ERR_NETWORK:
                errorMsg += ' Network error occurred.';
                break;
              case MediaError.MEDIA_ERR_DECODE:
                errorMsg += ' Audio format is not supported or file is corrupted.';
                break;
              case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                errorMsg += ' Audio format is not supported by your browser.';
                break;
              default:
                errorMsg += ' Unknown error occurred.';
            }
          }
          
          console.error('❌ Error message to user:', errorMsg);
          alert(errorMsg);
        };
        
        // Simple and direct audio setup
        console.log('🎤 Setting up audio for playback:', audioUrl);
        audio.src = audioUrl;
        audio.preload = 'auto';
        
        // Basic event listeners
        audio.onloadstart = () => console.log('📦 Audio loading...');
        audio.oncanplay = () => console.log('✅ Audio ready to play');
        audio.onloadeddata = () => console.log('✅ Audio data loaded');
        
        // Direct play attempt
        try {
          console.log('🎤 Attempting direct audio play...');
          const playPromise = audio.play();
          
          if (playPromise !== undefined) {
            await playPromise;
            console.log('▶️ Audio playback started successfully');
          }
        } catch (playError: any) {
          console.error('❌ Failed to play audio:', playError);
          console.error('Play error details:', {
            name: playError?.name || 'Unknown',
            message: playError?.message || 'Unknown error',
            code: playError?.code || 'Unknown'
          });
          setIsVoicePlaying(false);
          
          // Try alternative playback method
          try {
            console.log('🔄 Trying alternative playback method...');
            const alternativeAudio = new Audio(audioUrl);
            alternativeAudio.crossOrigin = 'anonymous';
            await alternativeAudio.play();
            audioRef.current = alternativeAudio;
            setIsVoicePlaying(true);
            console.log('✅ Alternative playback successful');
          } catch (altError) {
            console.error('❌ Alternative playback also failed:', altError);
            alert(`Could not play voice message. Audio format may not be supported by your browser.\n\nError: ${playError?.message || 'Unknown error'}\n\nTry using a different browser or updating your current browser.`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Voice playback error:', error);
      setIsVoicePlaying(false);
    }
  };

  const handleReaction = async (emoji: string) => {
    try {
      const response = await messageAPI.addReaction(message._id, emoji);
      setReactions((response.data as any).reactions);
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  const handleDelete = async () => {
    try {
      await messageAPI.deleteMessage(message._id);
      // Message will be updated via socket
    } catch (error) {
      console.error('Error deleting message:', error);
    }
    setMenuAnchor(null);
  };

  // Helper function to detect if message contains voice data
  const isVoiceMessage = () => {
    // Check if it's explicitly marked as voice type
    if (message.type === 'voice') return true;
    
    // Check if message content contains voice JSON data
    if (message.content && message.content.includes('audioUrl')) {
      try {
        const parsed = JSON.parse(message.content);
        return parsed.audioUrl && parsed.duration;
      } catch {
        return false;
      }
    }
    
    // Check for attachment with audio type (this is the main case now)
    if (message.attachment && message.attachment.mimeType?.startsWith('audio/')) {
      return true;
    }
    
    // Check for webm voice files
    if (message.attachment && message.attachment.filename?.includes('voice-') && 
        message.attachment.mimeType === 'audio/webm') {
      return true;
    }
    
    return false;
  };

  const renderMessageContent = () => {
    // Handle voice messages regardless of type field
    if (isVoiceMessage()) {
      let duration = 0;
      let voiceData = null;
      
      // Try to extract duration from JSON content
      if (message.content && message.content.includes('audioUrl')) {
        try {
          voiceData = JSON.parse(message.content);
          duration = voiceData.duration || 0;
        } catch (error) {
          console.log('Could not parse voice data from content');
        }
      }
      
      // Fallback to attachment or voiceNote duration
      if (!duration) {
        duration = (message.attachment as any)?.duration || message.voiceNote?.duration || 0;
      }
      
      return (
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          minWidth: 200,
          p: 1,
          bgcolor: isOwn ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
          borderRadius: 2
        }}>
          <IconButton 
            size="small" 
            onClick={handleVoicePlayback}
            sx={{
              bgcolor: isVoicePlaying ? 'error.main' : 'primary.main',
              color: 'white',
              '&:hover': {
                bgcolor: isVoicePlaying ? 'error.dark' : 'primary.dark',
              }
            }}
          >
            {isVoicePlaying ? <Pause /> : <PlayArrow />}
          </IconButton>
          
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <VolumeUp sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                Voice message {duration > 0 ? `(${Math.round(duration)}s)` : ''}
              </Typography>
            </Box>
            
            {/* Progress bar for voice playback */}
            <Box sx={{ 
              width: '100%', 
              height: 4, 
              bgcolor: 'divider', 
              borderRadius: 2, 
              mt: 0.5,
              overflow: 'hidden'
            }}>
              <Box sx={{
                width: `${voiceProgress}%`,
                height: '100%',
                bgcolor: isOwn ? 'rgba(255,255,255,0.7)' : 'primary.main',
                borderRadius: 2,
                transition: 'width 0.1s ease'
              }} />
            </Box>
            
            {/* Simple waveform visualization */}
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 0.5, 
              mt: 0.5,
              height: 20 
            }}>
              {Array.from({ length: 20 }, (_, index) => {
                // Create consistent waveform pattern based on message ID
                const messageHash = message._id.charCodeAt(index % message._id.length) || 1;
                const height = ((messageHash % 15) + 5);
                return (
                  <Box
                    key={index}
                    sx={{
                      width: 2,
                      height: `${height}px`,
                      bgcolor: voiceProgress > (index * 5) 
                        ? (isOwn ? 'rgba(255,255,255,0.7)' : 'primary.main')
                        : 'divider',
                      borderRadius: 1,
                      transition: 'background-color 0.3s ease'
                    }}
                  />
                );
              })}
            </Box>
          </Box>
        </Box>
      );
    }
    
    switch (message.type) {
      case 'text':
        return (
          <Typography
            variant="body1"
            sx={{
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
            }}
          >
            {message.content}
          </Typography>
        );

      case 'image':
        return (
          <Box>
            <img
              src={message.attachment?.url}
              alt="Shared image"
              style={{
                maxWidth: '100%',
                maxHeight: 300,
                borderRadius: 8,
                objectFit: 'cover',
              }}
            />
            {message.content && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                {message.content}
              </Typography>
            )}
          </Box>
        );

      case 'file':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Paper
              sx={{
                p: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                minWidth: 200,
              }}
            >
              <Typography variant="body2">
                {message.attachment?.filename}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ({(message.attachment?.size || 0) / 1024} KB)
              </Typography>
            </Paper>
          </Box>
        );


      case 'call':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Call sx={{ fontSize: 20 }} />
            <Typography variant="body2">
              {message.content}
            </Typography>
          </Box>
        );

      default:
        return (
          <Typography variant="body1">
            {message.content}
          </Typography>
        );
    }
  };

  const renderReactions = () => {
    if (reactions.length === 0) return null;

    const reactionGroups = reactions.reduce((acc, reaction) => {
      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = [];
      }
      acc[reaction.emoji].push(reaction);
      return acc;
    }, {} as Record<string, typeof reactions>);

    return (
      <Box className="message-reactions" sx={{ mt: 0.5 }}>
        {Object.entries(reactionGroups).map(([emoji, group]) => (
          <Chip
            key={emoji}
            label={`${emoji} ${group.length}`}
            size="small"
            onClick={() => handleReaction(emoji)}
            className={group.some(r => r.user === message.sender._id) ? 'own' : ''}
          />
        ))}
      </Box>
    );
  };

  if (message.type === 'system') {
    return (
      <Box sx={{ textAlign: 'center', my: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {message.content}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isOwn ? 'flex-end' : 'flex-start',
        mb: 1,
        px: 1,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: isOwn ? 'row-reverse' : 'row',
          alignItems: 'flex-end',
          gap: 1,
          maxWidth: '70%',
        }}
      >
        {!isOwn && (
          <Avatar
            src={message.sender.profilePicture}
            sx={{ width: 32, height: 32 }}
          >
            {message.sender.username.charAt(0).toUpperCase()}
          </Avatar>
        )}

        <Box
          sx={{
            position: 'relative',
            '&:hover .message-actions': {
              opacity: 1,
            },
          }}
        >
          <Paper
            className="glass-card btn-3d"
            elevation={0}
            sx={{
              p: 2,
              background: isOwn 
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              color: 'white',
              borderRadius: '18px',
              borderBottomRightRadius: isOwn ? '6px' : '18px',
              borderBottomLeftRadius: isOwn ? '18px' : '6px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: isOwn 
                ? '0 8px 32px rgba(102, 126, 234, 0.3)' 
                : '0 8px 32px rgba(240, 147, 251, 0.3)',
              backdropFilter: 'blur(20px)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                transform: 'translateY(-2px) scale(1.02)',
                boxShadow: isOwn 
                  ? '0 12px 48px rgba(102, 126, 234, 0.4)' 
                  : '0 12px 48px rgba(240, 147, 251, 0.4)',
              },
            }}
          >
            {message.replyTo && (
              <Box
                sx={{
                  borderLeft: 3,
                  borderColor: isOwn ? 'primary.light' : 'primary.main',
                  pl: 1,
                  mb: 1,
                  bgcolor: isOwn ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                  borderRadius: 1,
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  Replying to {message.replyTo.sender.username}
                </Typography>
                <Typography variant="body2" noWrap>
                  {message.replyTo.content}
                </Typography>
              </Box>
            )}

            {renderMessageContent()}

            {message.isEdited && (
              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                (edited)
              </Typography>
            )}

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: isOwn ? 'flex-end' : 'flex-start',
                mt: 0.5,
                gap: 1,
              }}
            >
              <Typography
                variant="caption"
                color={isOwn ? 'rgba(255, 255, 255, 0.8)' : 'text.secondary'}
                sx={{ fontSize: '0.7rem' }}
              >
                {formatTime(message.createdAt)}
              </Typography>
              <MessageStatus status={message.status} isOwn={isOwn} />
            </Box>

            {renderReactions()}
          </Paper>

          <Box
            className="message-actions"
            sx={{
              position: 'absolute',
              top: -8,
              right: isOwn ? 'auto' : -8,
              left: isOwn ? -8 : 'auto',
              opacity: 0,
              transition: 'opacity 0.2s',
              bgcolor: 'background.paper',
              borderRadius: 1,
              boxShadow: 1,
            }}
          >
            <IconButton
              size="small"
              onClick={(e) => setMenuAnchor(e.currentTarget)}
            >
              <MoreVert fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      </Box>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={() => handleReaction('👍')}>
          <ThumbUp sx={{ mr: 1 }} />
          Like
        </MenuItem>
        <MenuItem onClick={() => handleReaction('❤️')}>
          <Favorite sx={{ mr: 1 }} />
          Love
        </MenuItem>
        <MenuItem onClick={() => handleReaction('😂')}>
          <SentimentVerySatisfied sx={{ mr: 1 }} />
          Laugh
        </MenuItem>
        <MenuItem onClick={() => handleReaction('😮')}>
          <SentimentNeutral sx={{ mr: 1 }} />
          Surprised
        </MenuItem>
        <MenuItem onClick={() => handleReaction('😢')}>
          <SentimentSatisfied sx={{ mr: 1 }} />
          Sad
        </MenuItem>
        <MenuItem onClick={() => handleReaction('😡')}>
          <SentimentDissatisfied sx={{ mr: 1 }} />
          Angry
        </MenuItem>
        {isOwn && (
          <>
            <MenuItem>
              <Edit sx={{ mr: 1 }} />
              Edit
            </MenuItem>
            <MenuItem onClick={handleDelete}>
              <Delete sx={{ mr: 1 }} />
              Delete
            </MenuItem>
          </>
        )}
        <MenuItem>
          <Reply sx={{ mr: 1 }} />
          Reply
        </MenuItem>
        <MenuItem>
          <Forward sx={{ mr: 1 }} />
          Forward
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default MessageBubble;
