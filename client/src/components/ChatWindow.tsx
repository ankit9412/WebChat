import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  Badge,
  TextField,
  InputAdornment,
  Fab,
  Chip,
  Menu,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  Divider,
  Paper,
  useTheme,
} from '@mui/material';
import {
  ArrowBack,
  Call,
  Videocam,
  MoreVert,
  Send,
  AttachFile,
  EmojiEmotions,
  Mic,
  MicOff,
  Phone,
  Block,
  Report,
  Info,
} from '@mui/icons-material';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import MessageBubble from './MessageBubble';
import MessageStatus from './MessageStatus';
import UniversalVoiceRecorder from './UniversalVoiceRecorder';
import FileUpload from './FileUpload';
import EmojiPicker from './EmojiPicker';
import { messageAPI, userAPI } from '../services/api';
import AudioUtils from '../utils/audioUtils';
import moment from 'moment-timezone';
import './ChatWindow.css';

interface User {
  _id: string;
  username: string;
  email: string;
  profilePicture?: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  lastSeen: string;
}

interface Message {
  _id: string;
  sender: {
    _id: string;
    username: string;
    profilePicture?: string;
  };
  receiver: string;
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

interface ChatWindowProps {
  user: User;
  onCall: (type: 'audio' | 'video') => void;
  onBack: () => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ user, onCall, onBack }) => {
  const theme = useTheme();
  const { user: currentUser } = useAuth();
  const { socket, emit, on, off } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [typing, setTyping] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // const notificationSoundRef = useRef<(() => void) | null>(null);

  const loadMessages = useCallback(async () => {
    try {
      const response = await messageAPI.getConversation(user._id);
      setMessages(response.data as Message[]);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }, [user._id]);

  useEffect(() => {
    loadMessages();
    
    // Periodic message refresh to ensure sync
    const messageRefreshInterval = setInterval(() => {
      console.log('🔄 PERIODIC MESSAGE REFRESH');
      loadMessages();
    }, 2000); // Refresh every 2 seconds
    
    // TODO: Add notification sound later
    // Initialize notification sound with a simple beep
    // Create a simple beep sound using Web Audio API
    
    return () => {
      clearInterval(messageRefreshInterval);
    };
  }, [user._id, loadMessages]);
  
  const playNotificationSound = () => {
    // TODO: Add notification sound
    console.log('🔊 New message received!');
  };

  useEffect(() => {
    if (socket) {
      // Listen for new messages
      const handleNewMessage = (message: Message) => {
        console.log('📨 NEW MESSAGE RECEIVED in ChatWindow:', {
          messageId: message._id,
          content: message.content.substring(0, 50) + '...',
          sender: message.sender._id,
          receiver: message.receiver,
          currentUserId: currentUser?.id,
          chatUserId: user._id
        });
        
        // More comprehensive message checking
        const currentUserId = currentUser?.id;
        const chatUserId = user._id;
        const messageSenderId = message.sender._id;
        const messageReceiverId = message.receiver;
        
        // Check if this message belongs to the current conversation
        const isMessageForThisConversation = 
          // Message from me to the chat user
          (messageSenderId === currentUserId && messageReceiverId === chatUserId) ||
          // Message from chat user to me
          (messageSenderId === chatUserId && messageReceiverId === currentUserId);
        
        console.log('🔍 CONVERSATION CHECK:', {
          isMessageForThisConversation,
          case1_myMessageToThem: messageSenderId === currentUserId && messageReceiverId === chatUserId,
          case2_theirMessageToMe: messageSenderId === chatUserId && messageReceiverId === currentUserId
        });
        
        if (isMessageForThisConversation) {
          console.log('✅ MESSAGE BELONGS TO THIS CONVERSATION - ADDING TO CHAT WINDOW');
          
          setMessages(prev => {
            // Check for duplicates
            const messageExists = prev.some(msg => msg._id === message._id);
            
            if (!messageExists) {
              console.log('➡️ ADDING NEW MESSAGE TO CHAT WINDOW:', message.content);
              
              // Handle incoming message (not from current user)
              if (messageSenderId !== currentUserId) {
                // Mark as delivered
                messageAPI.markMessageDelivered(message._id).catch(err => 
                  console.error('Failed to mark as delivered:', err)
                );
                
                // Mark as read after a short delay
                setTimeout(() => {
                  messageAPI.markMessageRead(message._id).catch(err => 
                    console.error('Failed to mark as read:', err)
                  );
                }, 500);
                
                // Play notification sound
                playNotificationSound();
              }
              
              const newMessages = [...prev, message];
              console.log('🆕 UPDATED MESSAGES COUNT:', newMessages.length);
              return newMessages;
            } else {
              console.log('⚠️ MESSAGE ALREADY EXISTS IN CHAT WINDOW');
              return prev;
            }
          });
        } else {
          console.log('❌ MESSAGE NOT FOR THIS CONVERSATION - IGNORING');
        }
      };

      // Listen for message sent confirmation
      const handleMessageSent = (message: Message) => {
        setMessages(prev => {
          const exists = prev.some(msg => msg._id === message._id);
          if (!exists) {
            return [...prev, message];
          }
          return prev;
        });
      };

      // Listen for typing indicators
      const handleTyping = (data: { userId: string; username: string; isTyping: boolean }) => {
        if (data.userId === user._id) {
          setIsTyping(data.isTyping);
        }
      };

      // Listen for message status updates
      const handleMessageDelivered = (data: { messageId: string; status: string }) => {
        setMessages(prev => 
          prev.map(msg => 
            msg._id === data.messageId 
              ? { ...msg, status: 'delivered' as const }
              : msg
          )
        );
      };

      const handleMessageRead = (data: { messageId: string; status: string }) => {
        setMessages(prev => 
          prev.map(msg => 
            msg._id === data.messageId 
              ? { ...msg, status: 'read' as const }
              : msg
          )
        );
      };

      const handleConversationRead = (data: { readBy: string }) => {
        // Mark all sent messages as read
        setMessages(prev => 
          prev.map(msg => 
            msg.sender._id === currentUser?.id && msg.receiver === user._id
              ? { ...msg, status: 'read' as const }
              : msg
          )
        );
      };

      // Main message listeners
      on('new-message', handleNewMessage);
      on('message-sent', handleMessageSent);
      on('user-typing', handleTyping);
      on('user-stop-typing', handleTyping);
      on('message-delivered', handleMessageDelivered);
      on('message-read', handleMessageRead);
      on('conversation-read', handleConversationRead);
      
      // AGGRESSIVE MESSAGE CATCHING - Listen for ANY message-related events
      const forceMessageDisplay = (eventName: string, data: any) => {
        console.log(`🚑 EMERGENCY MESSAGE CATCHER - Event: ${eventName}`, data);
        
        // If it looks like a message event, force display it
        if (data && typeof data === 'object' && data.content && data.sender && data.receiver) {
          const message = data as Message;
          console.log('🆘 EMERGENCY DISPLAYING MESSAGE:', message.content);
          
          // Force message display regardless of other logic
          setMessages(prev => {
            const exists = prev.some(msg => msg._id === message._id);
            if (!exists) {
              console.log('🔥 EMERGENCY MESSAGE ADDED TO CHAT');
              return [...prev, message];
            }
            return prev;
          });
        }
      };
      
      // Listen for various message event names
      on('message', forceMessageDisplay);
      on('chat-message', forceMessageDisplay);
      on('real-time-message', forceMessageDisplay);
      
      // Fallback broadcast listener - FORCE message display
      const handleMessageBroadcast = (data: { senderId: string; receiverId: string; message: Message }) => {
        console.log('📡 FALLBACK BROADCAST MESSAGE RECEIVED:', {
          broadcastSender: data.senderId,
          broadcastReceiver: data.receiverId,
          messageContent: data.message.content.substring(0, 50) + '...',
          currentUserId: currentUser?.id,
          chatUserId: user._id
        });
        
        // Check if this message is for this conversation
        const isForThisConversation = 
          (data.senderId === user._id && data.receiverId === currentUser?.id) ||
          (data.senderId === currentUser?.id && data.receiverId === user._id);
          
        console.log('🔍 BROADCAST CONVERSATION CHECK:', { isForThisConversation });
          
        if (isForThisConversation) {
          console.log('✅ BROADCAST MESSAGE IS FOR THIS CONVERSATION - FORCING DISPLAY');
          
          // Force add message directly to ensure it appears
          setMessages(prev => {
            const exists = prev.some(msg => msg._id === data.message._id);
            if (!exists) {
              console.log('🚀 FORCING MESSAGE DISPLAY VIA BROADCAST');
              return [...prev, data.message];
            }
            return prev;
          });
          
          // Also call the regular handler
          handleNewMessage(data.message);
        } else {
          console.log('❌ BROADCAST MESSAGE NOT FOR THIS CONVERSATION');
        }
      };
      
      on('message-broadcast', handleMessageBroadcast);

      return () => {
        off('new-message', handleNewMessage);
        off('message-sent', handleMessageSent);
        off('user-typing', handleTyping);
        off('user-stop-typing', handleTyping);
        off('message-delivered', handleMessageDelivered);
        off('message-read', handleMessageRead);
        off('conversation-read', handleConversationRead);
        off('message-broadcast', handleMessageBroadcast);
      };
    }
  }, [socket, user._id, currentUser?.id, on, off]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentUser) {
      console.log('❌ Cannot send message:', { 
        hasMessage: !!newMessage.trim(), 
        hasUser: !!currentUser 
      });
      return;
    }

    const messageContent = newMessage.trim();
    console.log('📤 SENDING MESSAGE:', messageContent, 'to:', user.username);
    setNewMessage(''); // Clear input immediately for better UX

    const messageData = {
      receiver: user._id,
      content: messageContent,
      type: 'text' as const,
      replyTo: undefined as string | undefined,
    };

    // Create optimistic message for immediate UI feedback
    const optimisticMessage: Message = {
      _id: 'temp-' + Date.now(), // Temporary ID
      sender: {
        _id: currentUser.id,
        username: currentUser.username,
        profilePicture: currentUser.profilePicture
      },
      receiver: user._id,
      content: messageContent,
      type: 'text',
      createdAt: new Date().toISOString(),
      status: 'sent',
      isEdited: false,
      reactions: []
    };

    // Add message to UI immediately with enhanced logging
    console.log('➡️ ADDING OPTIMISTIC MESSAGE TO CHAT:', optimisticMessage.content);
    setMessages(prev => {
      const newMessages = [...prev, optimisticMessage];
      console.log('🆕 MESSAGES COUNT AFTER OPTIMISTIC ADD:', newMessages.length);
      return newMessages;
    });

    try {
      console.log('📤 SENDING MESSAGE TO SERVER...');
      const response = await messageAPI.sendMessage(
        messageData.receiver,
        messageData.content,
        messageData.type,
        messageData.replyTo
      );
      
      // Replace optimistic message with real message
      const realMessage = response.data as Message;
      console.log('✅ MESSAGE SENT SUCCESSFULLY, REPLACING OPTIMISTIC:', realMessage);
      
      setMessages(prev => {
        const updatedMessages = prev.map(msg => 
          msg._id === optimisticMessage._id 
            ? realMessage 
            : msg
        );
        console.log('🆕 MESSAGES COUNT AFTER SERVER RESPONSE:', updatedMessages.length);
        return updatedMessages;
      });
      
      // Force immediate refresh to ensure message appears
      setTimeout(() => {
        console.log('🔄 FORCING MESSAGE REFRESH AFTER SEND');
        loadMessages();
      }, 100);
      
    } catch (error) {
      console.error('❌ ERROR SENDING MESSAGE:', error);
      // Remove optimistic message on error
      setMessages(prev => 
        prev.filter(msg => msg._id !== optimisticMessage._id)
      );
      // Restore message content
      setNewMessage(messageContent);
      
      // Try to reload messages in case the message was actually sent
      setTimeout(() => {
        loadMessages();
      }, 500);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleTyping = () => {
    if (!currentUser || !typing) {
      setTyping(true);
      emit('typing', { 
        userId: currentUser?.id,
        receiverId: user._id, 
        username: currentUser?.username,
        isTyping: true 
      });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setTyping(false);
      emit('stop-typing', { 
        userId: currentUser?.id,
        receiverId: user._id, 
        username: currentUser?.username,
        isTyping: false 
      });
    }, 1000);
  };

  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleBlockUser = async () => {
    try {
      await userAPI.blockUser(user._id);
      setMenuAnchor(null);
      console.log('User blocked successfully');
      onBack(); // Go back to chat list after blocking
    } catch (error) {
      console.error('Error blocking user:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'success';
      case 'away': return 'warning';
      case 'busy': return 'error';
      default: return 'default';
    }
  };

  const formatLastSeen = (lastSeen: string) => {
    return moment(lastSeen).tz('Asia/Kolkata').format('MMM DD, YYYY [at] h:mm A');
  };

  return (
    <Box className="glass-card" sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      background: 'rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '20px',
      m: 1,
      overflow: 'hidden',
      boxShadow: '0 25px 50px rgba(0, 0, 0, 0.15)',
    }}>
      {/* Header */}
      <AppBar 
        position="static" 
        color="default" 
        elevation={0}
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          boxShadow: '0 4px 20px rgba(102, 126, 234, 0.3)',
        }}
      >
        <Toolbar sx={{ py: 1 }}>
          <IconButton 
            edge="start" 
            onClick={onBack} 
            sx={{ 
              mr: 2,
              color: 'white',
              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }
            }}
          >
            <ArrowBack />
          </IconButton>
          <Avatar 
            src={user.profilePicture} 
            sx={{ 
              mr: 2,
              width: 48,
              height: 48,
              border: '2px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}
          >
            {user.username.charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: 'white' }}>
              {user.username}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                label={user.status}
                size="small"
                sx={{
                  bgcolor: getStatusColor(user.status) === 'success' ? '#10b981' : 
                           getStatusColor(user.status) === 'warning' ? '#f59e0b' :
                           getStatusColor(user.status) === 'error' ? '#ef4444' : '#6b7280',
                  color: 'white',
                  fontWeight: 500,
                  fontSize: '0.7rem'
                }}
              />
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                {user.status === 'online' ? 'Online' : `Last seen ${formatLastSeen(user.lastSeen)}`}
              </Typography>
            </Box>
          </Box>
          <IconButton 
            onClick={() => onCall('audio')} 
            sx={{ 
              color: 'white',
              mx: 0.5,
              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)', transform: 'scale(1.1)' },
              transition: 'all 0.2s'
            }}
            title="Audio Call"
          >
            <Call />
          </IconButton>
          <IconButton 
            onClick={() => onCall('video')} 
            sx={{ 
              color: 'white',
              mx: 0.5,
              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)', transform: 'scale(1.1)' },
              transition: 'all 0.2s'
            }}
            title="Video Call"
          >
            <Videocam />
          </IconButton>
          <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)}>
            <MoreVert />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Messages */}
      <Box className="glass-card" sx={{ 
        flex: 1, 
        overflow: 'auto', 
        p: 2,
        m: 1,
        borderRadius: '15px',
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(15px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1))',
          borderRadius: 'inherit',
          zIndex: 1
        },
        '& > *': {
          position: 'relative',
          zIndex: 2
        }
      }}>
        <List sx={{ py: 0 }}>
          {messages.map((message) => {
            const isOwn = message.sender._id === currentUser?.id || message.sender._id === (currentUser as any)?._id;
            console.log('Message:', {
              messageId: message._id,
              senderId: message.sender._id,
              currentUserId: currentUser?.id,
              isOwn,
              content: message.content
            });
            return (
              <MessageBubble
                key={message._id}
                message={message}
                isOwn={isOwn}
              />
            );
          })}
          {isTyping && (
            <ListItem>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      {user.username} is typing
                    </Typography>
                    <Box sx={{ ml: 1 }}>
                      <Box className="typing-dots">
                        <Box className="typing-dot" />
                        <Box className="typing-dot" />
                        <Box className="typing-dot" />
                      </Box>
                    </Box>
                  </Box>
                }
              />
            </ListItem>
          )}
          <div ref={messagesEndRef} />
        </List>
      </Box>

      {/* Message Input */}
      <Box className="glass-card" sx={{ 
        p: 3, 
        m: 1,
        borderRadius: '20px',
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(102, 126, 234, 0.2)',
        position: 'relative',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
          <TextField
            fullWidth
            multiline
            maxRows={4}
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              handleTyping();
            }}
            onKeyPress={handleKeyPress}
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '20px',
                background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
                border: '2px solid transparent',
                backgroundClip: 'padding-box',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  background: 'linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(248,250,252,1) 100%)',
                  boxShadow: '0 8px 24px rgba(102, 126, 234, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                  transform: 'translateY(-1px)',
                },
                '&.Mui-focused': {
                  background: 'linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(248,250,252,1) 100%)',
                  boxShadow: '0 8px 32px rgba(102, 126, 234, 0.25), 0 0 0 3px rgba(102, 126, 234, 0.1)',
                  transform: 'translateY(-2px)',
                  '& fieldset': {
                    borderColor: '#667eea',
                    borderWidth: 2,
                  },
                },
                '& fieldset': {
                  borderColor: 'transparent',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(102, 126, 234, 0.3)',
                },
              },
              '& .MuiInputBase-input': {
                fontSize: '0.95rem',
                padding: '12px 16px',
                color: '#1f2937',
                '&::placeholder': {
                  color: '#9ca3af',
                  opacity: 1
                }
              },
            }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton 
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    sx={{
                      color: showEmojiPicker ? '#f59e0b' : '#6b7280',
                      background: showEmojiPicker ? 'linear-gradient(135deg, #fef3c7, #fde68a)' : 'transparent',
                      transition: 'all 0.2s ease',
                      '&:hover': { 
                        bgcolor: 'rgba(245, 158, 11, 0.1)',
                        color: '#f59e0b',
                        transform: 'scale(1.1)'
                      }
                    }}
                  >
                    <EmojiEmotions />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <IconButton 
            onClick={() => setShowFileUpload(true)}
            sx={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: 'white',
              boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)',
              '&:hover': { 
                background: 'linear-gradient(135deg, #059669, #047857)',
                boxShadow: '0 6px 24px rgba(16, 185, 129, 0.4)',
                transform: 'translateY(-2px) scale(1.05)'
              },
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              width: '48px',
              height: '48px'
            }}
          >
            <AttachFile />
          </IconButton>
          <IconButton
            onClick={() => setShowVoiceRecorder(!showVoiceRecorder)}
            sx={{
              background: showVoiceRecorder 
                ? 'linear-gradient(135deg, #ef4444, #dc2626)' 
                : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
              color: 'white',
              boxShadow: showVoiceRecorder 
                ? '0 4px 16px rgba(239, 68, 68, 0.4)' 
                : '0 4px 16px rgba(139, 92, 246, 0.3)',
              '&:hover': { 
                background: showVoiceRecorder 
                  ? 'linear-gradient(135deg, #dc2626, #b91c1c)' 
                  : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                boxShadow: showVoiceRecorder 
                  ? '0 6px 24px rgba(239, 68, 68, 0.5)' 
                  : '0 6px 24px rgba(139, 92, 246, 0.4)',
                transform: 'translateY(-2px) scale(1.05)'
              },
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              width: '48px',
              height: '48px',
              animation: showVoiceRecorder ? 'pulse 1.5s infinite' : 'none'
            }}
          >
            {showVoiceRecorder ? <MicOff /> : <Mic />}
          </IconButton>
          <Fab
            size="medium"
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
            sx={{
              background: !newMessage.trim() 
                ? 'linear-gradient(135deg, #e5e7eb, #d1d5db)'
                : 'linear-gradient(135deg, #25d366, #20ba5a)',
              color: 'white',
              width: '56px',
              height: '56px',
              boxShadow: !newMessage.trim() 
                ? '0 4px 12px rgba(0, 0, 0, 0.1)' 
                : '0 8px 24px rgba(37, 211, 102, 0.4)',
              '&:hover': {
                background: !newMessage.trim()
                  ? 'linear-gradient(135deg, #e5e7eb, #d1d5db)'
                  : 'linear-gradient(135deg, #20ba5a, #16a34a)',
                boxShadow: !newMessage.trim()
                  ? '0 4px 12px rgba(0, 0, 0, 0.1)'
                  : '0 12px 32px rgba(37, 211, 102, 0.5)',
                transform: !newMessage.trim() ? 'none' : 'translateY(-3px) scale(1.05)',
              },
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&.Mui-disabled': {
                background: 'linear-gradient(135deg, #e5e7eb, #d1d5db)',
                color: '#9ca3af'
              },
              '&:active': {
                transform: !newMessage.trim() ? 'none' : 'translateY(-1px) scale(0.98)',
              }
            }}
          >
            <Send sx={{ 
              transform: 'rotate(-45deg)',
              fontSize: '24px',
              transition: 'transform 0.2s ease',
              '&:hover': {
                transform: 'rotate(-45deg) scale(1.1)'
              }
            }} />
          </Fab>
        </Box>

        {/* Voice Recorder */}
        {showVoiceRecorder && (
          <UniversalVoiceRecorder
            onSend={async (voiceData) => {
              try {
                console.log('🎤 SENDING VOICE MESSAGE WITH FILE UPLOAD:', voiceData);
                
                console.log('🎤 BULLETPROOF voice upload starting...', voiceData);
                
                // Convert blob URL to actual File object for upload
                const response = await fetch(voiceData.url);
                const audioBlob = await response.blob();
                
                console.log('🎤 Audio blob details:', {
                  type: audioBlob.type,
                  size: audioBlob.size
                });
                
                // Determine file extension from MIME type
                let extension = 'webm'; // Default
                let mimeType = audioBlob.type;
                
                if (mimeType.includes('wav') || mimeType.includes('wave')) {
                  extension = 'wav';
                } else if (mimeType.includes('webm')) {
                  extension = 'webm';
                } else if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
                  extension = 'm4a';
                } else if (mimeType.includes('ogg')) {
                  extension = 'ogg';
                }
                
                console.log('🎤 Using format:', { mimeType, extension });
                
                // Create a File object from the blob
                const audioFile = new File([audioBlob], `voice-${Date.now()}.${extension}`, {
                  type: mimeType
                });
                
                console.log('🎤 Audio file created:', {
                  name: audioFile.name,
                  size: audioFile.size,
                  type: audioFile.type
                });
                
                // Upload the audio file to the server
                console.log('📤 UPLOADING VOICE MESSAGE FILE TO SERVER...');
                const uploadResponse = await messageAPI.sendFile(
                  user._id,
                  audioFile,
                  'voice'
                );
                
                console.log('✅ Voice message uploaded successfully:', (uploadResponse as any)?.data || 'Upload completed');
                setShowVoiceRecorder(false);
                
                // Force reload messages to show the new voice message
                setTimeout(() => {
                  loadMessages();
                }, 200);
                
              } catch (error) {
                console.error('❌ Error sending voice message:', error);
                alert('Failed to send voice message. Please try again.');
                setShowVoiceRecorder(false);
              }
            }}
            onCancel={() => setShowVoiceRecorder(false)}
          />
        )}

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <EmojiPicker
            onEmojiSelect={handleEmojiSelect}
            onClose={() => setShowEmojiPicker(false)}
          />
        )}
      </Box>

      {/* File Upload */}
      <FileUpload
        open={showFileUpload}
        onClose={() => setShowFileUpload(false)}
        receiverId={user._id}
        onFileSelect={async (file) => {
          try {
            console.log('File uploaded successfully:', file.name);
            // File is already sent by FileUpload component
            // Just close the dialog and reload messages to see the new message
            await loadMessages();
            setShowFileUpload(false);
          } catch (error) {
            console.error('Error handling file upload:', error);
          }
        }}
      />

      {/* User Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem>
          <Info sx={{ mr: 1 }} />
          View Profile
        </MenuItem>
        <MenuItem>
          <Phone sx={{ mr: 1 }} />
          Call
        </MenuItem>
        <MenuItem>
          <Videocam sx={{ mr: 1 }} />
          Video Call
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleBlockUser}>
          <Block sx={{ mr: 1 }} />
          Block User
        </MenuItem>
        <MenuItem>
          <Report sx={{ mr: 1 }} />
          Report
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default ChatWindow;
