import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  Badge,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  TextField,
  InputAdornment,
  Fab,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Chip,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import '../styles/3d-theme.css';
import {
  Menu as MenuIcon,
  Search,
  MoreVert,
  VideoCall,
  Call,
  Send,
  AttachFile,
  EmojiEmotions,
  Mic,
  MicOff,
  Videocam,
  VideocamOff,
  VolumeUp,
  VolumeOff,
  Settings,
  Logout,
  Add,
  PersonAdd,
  Block,
  Report,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import ChatWindow from '../components/ChatWindow';
import ReliableCallInterface from '../components/ReliableCallInterface';
import CallNotification from '../components/CallNotification';
import UserSearch from '../components/UserSearch';
import SettingsDialog from '../components/SettingsDialog';
import Stories from '../components/Stories';
import { messageAPI, userAPI, callAPI } from '../services/api';
import moment from 'moment-timezone';
import './Chat.css';

interface User {
  _id: string;
  username: string;
  email: string;
  profilePicture?: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  lastSeen: string;
}

interface Conversation {
  user: User;
  lastMessage: {
    _id: string;
    content: string;
    type: string;
    createdAt: string;
    status: string;
  };
  unreadCount: number;
}

const Chat: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, logout } = useAuth();
  const { socket, isConnected } = useSocket();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  
  // BULLETPROOF state setter that prevents duplicates
  const setBulletproofConversations = (newConversations: Conversation[] | ((prev: Conversation[]) => Conversation[])) => {
    if (typeof newConversations === 'function') {
      setConversations(prev => {
        const result = newConversations(prev);
        return deduplicateConversations(result);
      });
    } else {
      setConversations(deduplicateConversations(newConversations));
    }
  };
  
  // Helper function to deduplicate conversations
  const deduplicateConversations = (convs: Conversation[]): Conversation[] => {
    const seen = new Set<string>();
    const unique: Conversation[] = [];
    
    for (const conv of convs) {
      const userId = conv.user._id.toString();
      if (!seen.has(userId)) {
        seen.add(userId);
        unique.push(conv);
      }
    }
    
    console.log('🚯 STATE DEDUPLICATION:', convs.length, '→', unique.length);
    return unique;
  };
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [callDialog, setCallDialog] = useState<{
    open: boolean;
    type: 'audio' | 'video' | null;
    user: User | null;
    isIncoming: boolean;
  }>({ open: false, type: null, user: null, isIncoming: false });
  
  const [incomingCall, setIncomingCall] = useState<{
    open: boolean;
    type: 'audio' | 'video' | null;
    caller: User | null;
  }>({ open: false, type: null, caller: null });

  const loadConversations = async () => {
    try {
      console.log('🚯 BULLETPROOF LOADING CONVERSATIONS FROM API...');
      const response = await messageAPI.getRecentConversations();
      const rawConversations = response.data as Conversation[];
      
      console.log('🚯 RAW CONVERSATIONS RECEIVED:', rawConversations.length);
      rawConversations.forEach((conv, index) => {
        console.log(`🚯 [${index}] USER:`, conv.user.username, 'ID:', conv.user._id);
      });
      
      // BULLETPROOF deduplication using Set for tracking
      const seenUserIds = new Set<string>();
      const absolutelyUniqueConversations: Conversation[] = [];
      
      for (const conversation of rawConversations) {
        const userIdStr = conversation.user._id.toString();
        
        if (!seenUserIds.has(userIdStr)) {
          seenUserIds.add(userIdStr);
          absolutelyUniqueConversations.push(conversation);
          console.log('✅ ACCEPTED CONVERSATION:', conversation.user.username);
        } else {
          console.log('🚫 REJECTED DUPLICATE:', conversation.user.username);
        }
      }
      
      console.log('💫 BULLETPROOF FINAL COUNT:', absolutelyUniqueConversations.length);
      
      setBulletproofConversations(absolutelyUniqueConversations);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  useEffect(() => {
    loadConversations();
    
    // Periodic refresh to prevent duplicates and ensure sync
    const conversationRefreshInterval = setInterval(() => {
      console.log('🔄 PERIODIC CONVERSATION REFRESH');
      loadConversations();
    }, 10000); // Refresh every 10 seconds
    
    return () => {
      clearInterval(conversationRefreshInterval);
    };
  }, []);

  useEffect(() => {
    if (socket) {
      // Real-time message updates with enhanced duplicate prevention
      const handleNewMessage = (message: any) => {
        console.log('📨 CONVERSATION UPDATE - New message received:', {
          messageId: message._id,
          from: message.sender._id,
          to: message.receiver,
          content: message.content.substring(0, 50) + '...'
        });
        
        // Update conversations list immediately
        setBulletproofConversations(prev => {
          console.log('📋 CURRENT CONVERSATIONS COUNT:', prev.length);
          
          // Find conversation partner (the other user)
          const conversationPartnerId = message.sender._id === user?.id 
            ? message.receiver 
            : message.sender._id;
          
          console.log('🔍 LOOKING FOR CONVERSATION WITH:', conversationPartnerId);
          
          const existingIndex = prev.findIndex(conv => 
            conv.user._id === conversationPartnerId
          );
          
          if (existingIndex !== -1) {
            console.log('✅ UPDATING EXISTING CONVERSATION AT INDEX:', existingIndex);
            // Update existing conversation
            const updatedConversations = [...prev];
            const updatedConversation = {
              ...updatedConversations[existingIndex],
              lastMessage: {
                _id: message._id,
                content: message.content,
                type: message.type,
                createdAt: message.createdAt,
                status: message.status
              },
              unreadCount: message.sender._id !== user?.id 
                ? updatedConversations[existingIndex].unreadCount + 1 
                : updatedConversations[existingIndex].unreadCount
            };
            
            // Move to top
            updatedConversations.splice(existingIndex, 1);
            const result = [updatedConversation, ...updatedConversations];
            
            console.log('🆕 UPDATED CONVERSATIONS COUNT:', result.length);
            return result;
          } else {
            console.log('➡️ ADDING NEW CONVERSATION');
            // Add new conversation (but make sure we have user data)
            const otherUser = message.sender._id !== user?.id ? message.sender : message.receiver;
            
            if (otherUser && otherUser._id) {
              const newConversation: Conversation = {
                user: otherUser,
                lastMessage: {
                  _id: message._id,
                  content: message.content,
                  type: message.type,
                  createdAt: message.createdAt,
                  status: message.status
                },
                unreadCount: message.sender._id !== user?.id ? 1 : 0
              };
              
              const result = [newConversation, ...prev];
              console.log('🆕 NEW CONVERSATIONS COUNT:', result.length);
              return result;
            }
          }
          
          return prev;
        });
        
        // Also refresh conversations after a short delay to ensure sync
        setTimeout(() => {
          console.log('🔄 REFRESHING CONVERSATIONS AFTER MESSAGE');
          loadConversations();
        }, 1000);
      };
      
      // Message sent confirmation
      const handleMessageSent = (message: any) => {
        console.log('Message sent confirmation:', message);
        handleNewMessage(message);
      };
      
      // Message status updates
      const handleMessageDelivered = (data: { messageId: string; status: string }) => {
        setBulletproofConversations(prev => 
          prev.map(conv => 
            conv.lastMessage._id === data.messageId 
              ? { ...conv, lastMessage: { ...conv.lastMessage, status: 'delivered' } }
              : conv
          )
        );
      };
      
      const handleMessageRead = (data: { messageId: string; status: string }) => {
        setBulletproofConversations(prev => 
          prev.map(conv => 
            conv.lastMessage._id === data.messageId 
              ? { ...conv, lastMessage: { ...conv.lastMessage, status: 'read' } }
              : conv
          )
        );
      };
      
      // Typing indicators
      const handleTyping = (data: { userId: string; username: string; isTyping: boolean }) => {
        // Update typing status in conversations if needed
        console.log('User typing:', data);
      };

      socket.on('new-message', handleNewMessage);
      socket.on('message-sent', handleMessageSent);
      socket.on('message-delivered', handleMessageDelivered);
      socket.on('message-read', handleMessageRead);
      socket.on('user-typing', handleTyping);
      socket.on('user-stop-typing', handleTyping);

      socket.on('incoming-call', (data) => {
        console.log('📞 SIMPLE: Incoming call:', data.type, 'from:', data.caller.username);
        
        setIncomingCall({
          open: true,
          type: data.type,
          caller: data.caller
        });
        
        console.log(`🔔 SIMPLE: Showing ${data.type} call from:`, data.caller.username);
      });

      // Call acceptance/rejection will be handled by WebRTC signaling
      socket.on('call-accepted', (data) => {
        console.log('✅ Call accepted via socket:', data);
      });

      socket.on('call-rejected', (data) => {
        console.log('❌ Call rejected via socket:', data);
        setCallDialog({ open: false, type: null, user: null, isIncoming: false });
        setIncomingCall({ open: false, type: null, caller: null });
        alert('Call was rejected.');
      });
      
      // Handle WebRTC signaling
      socket.on('webrtc-signal', (data) => {
        console.log('📡 WebRTC signal received in Chat:', data.type);
        // The WebRTC service will handle this automatically
      });

      return () => {
        socket.off('new-message', handleNewMessage);
        socket.off('message-sent', handleMessageSent);
        socket.off('message-delivered', handleMessageDelivered);
        socket.off('message-read', handleMessageRead);
        socket.off('user-typing', handleTyping);
        socket.off('user-stop-typing', handleTyping);
        socket.off('incoming-call');
        socket.off('call-accepted');
        socket.off('call-rejected');
        socket.off('webrtc-signal');
      };
    }
  }, [socket, user?.id]);

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  // Test function to verify call API works
  const testCallAPI = async () => {
    if (!selectedUser || !user) {
      alert('Please select a user first');
      return;
    }
    
    console.log('🧪 Testing call API...');
    try {
      const response = await callAPI.initiateCall(selectedUser._id, 'audio');
      console.log('✅ Call API test successful:', response);
      alert('Call API test successful! Check console for details.');
    } catch (error: any) {
      console.error('❌ Call API test failed:', error);
      alert(`Call API test failed: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleCall = async (type: 'audio' | 'video') => {
    if (!selectedUser || !user || !socket) {
      alert('Cannot start call - missing data or connection');
      console.error('❌ SIMPLE: Cannot start call:', { selectedUser: !!selectedUser, user: !!user, socket: !!socket });
      return;
    }

    console.log(`📞 SIMPLE: Starting ${type} call to:`, selectedUser.username);
    
    // IMMEDIATELY show call dialog
    setCallDialog({ open: true, type, user: selectedUser, isIncoming: false });
    
    // RELIABLE socket emit - notify the other user
    socket.emit('initiate-call', {
      type: type,
      to: selectedUser._id,
      callerName: user.username
    });
    
    console.log(`✅ SIMPLE: ${type} call started and dialog shown`);
    
    try {
      
    } catch (error: any) {
      console.error('❌ Error initiating call:', {
        status: error.response?.status,
        message: error.response?.data?.message,
        error: error.message
      });
      
      // Don't show generic errors that might cause confusion
      let errorMessage = 'Failed to start call. Please try again.';
      
      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.message;
        
        if (status === 401) {
          if (message?.includes('token')) {
            errorMessage = 'Session expired. Please log in again.';
          } else {
            errorMessage = 'Authentication error. Please try again.';
          }
        } else if (status === 403) {
          errorMessage = message || 'This user does not accept calls or has blocked you.';
        } else if (status === 404) {
          errorMessage = 'User not found or offline.';
        } else if (status === 500) {
          errorMessage = 'Server error. Please try again later.';
        }
      } else if (error.message?.includes('Network Error')) {
        errorMessage = 'Network error. Please check your connection.';
      }
      
      console.log('⚠️ Showing call error to user:', errorMessage);
      alert(errorMessage);
    }
  };

  const handleCallAccept = () => {
    // Handle call acceptance during ongoing call
    setCallDialog(prev => ({ ...prev, open: false }));
  };

  const handleCallReject = () => {
    // Handle call rejection during ongoing call
    setCallDialog({ open: false, type: null, user: null, isIncoming: false });
  };

  const handleIncomingCallAccept = () => {
    if (incomingCall.caller && socket) {
      console.log(`✅ SIMPLE: Accepting ${incomingCall.type} call from:`, incomingCall.caller.username);
      
      // Tell the caller we accepted
      socket.emit('call-accepted', {
        to: incomingCall.caller._id,
        type: incomingCall.type
      });
      
      // Show our call dialog
      setCallDialog({
        open: true,
        type: incomingCall.type!,
        user: incomingCall.caller,
        isIncoming: true
      });
    }
    setIncomingCall({ open: false, type: null, caller: null });
  };

  const handleIncomingCallReject = () => {
    if (incomingCall.caller && socket) {
      console.log(`❌ SIMPLE: Rejecting ${incomingCall.type} call from:`, incomingCall.caller.username);
      socket.emit('call-rejected', { to: incomingCall.caller._id });
    }
    setIncomingCall({ open: false, type: null, caller: null });
  };

  const handleCallEnd = () => {
    setCallDialog({ open: false, type: null, user: null, isIncoming: false });
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
    return moment(lastSeen).tz('Asia/Kolkata').fromNow();
  };

  const sidebar = (
    <Box className="glass-card" sx={{ width: 320, height: '100%', display: 'flex', flexDirection: 'column', m: 1, borderRadius: '20px' }}>
      {/* Header */}
      <Box className="glass-card" sx={{ p: 2, m: 1, borderRadius: '15px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar src={user?.profilePicture} sx={{ mr: 2 }}>
            {user?.username?.charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6">{user?.username}</Typography>
            <Typography variant="body2" color="text.secondary">
              {isConnected ? 'Online' : 'Offline'}
            </Typography>
          </Box>
          <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)}>
            <MoreVert />
          </IconButton>
        </Box>
        
        <TextField
          fullWidth
          placeholder="Search conversations..."
          size="small"
          className="glass-card ripple"
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '20px',
              background: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.2)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                transform: 'translateY(-2px) scale(1.02)',
                boxShadow: '0 12px 48px rgba(102, 126, 234, 0.3)',
                background: 'rgba(255,255,255,0.15)',
              },
              '&.Mui-focused': {
                transform: 'translateY(-3px) scale(1.02)',
                boxShadow: '0 16px 64px rgba(102, 126, 234, 0.4)',
                background: 'rgba(255,255,255,0.2)',
              },
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ 
                  color: '#667eea', 
                  transition: 'all 0.2s ease',
                  '&:hover': { transform: 'scale(1.1)' }
                }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Conversations List */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {conversations.length === 0 ? (
          <Box sx={{ 
            p: 4, 
            textAlign: 'center', 
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
          }}>
            {/* Chat Illustration */}
            <Box sx={{ 
              width: 120, 
              height: 120, 
              mb: 3,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
              position: 'relative',
              '&::before': {
                content: '""',
                position: 'absolute',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.1))',
                animation: 'pulse 2s infinite'
              }
            }}>
              <Search sx={{ fontSize: 48, color: 'white', zIndex: 1 }} />
            </Box>
            
            <Typography variant="h6" color="text.primary" gutterBottom sx={{ fontWeight: 600 }}>
              No conversations yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Start chatting with friends and colleagues
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ 
              opacity: 0.7,
              fontStyle: 'italic'
            }}>
              Click the + button below to find people to chat with
            </Typography>
          </Box>
        ) : (
          <List>
            {conversations.map((conversation) => (
            <ListItem
              key={conversation.user._id}
              component="div"
              onClick={() => handleUserSelect(conversation.user)}
              className="glass-card ripple slide-in-left"
              sx={{ 
                m: 1,
                borderRadius: '15px',
                cursor: 'pointer',
                background: selectedUser?._id === conversation.user._id 
                  ? 'rgba(102, 126, 234, 0.2)' 
                  : 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                '&:hover': { 
                  background: 'rgba(102, 126, 234, 0.15)',
                  transform: 'translateY(-2px) scale(1.02)',
                  boxShadow: '0 8px 32px rgba(102, 126, 234, 0.2)'
                }
              }}
            >
              <ListItemAvatar>
                <Badge
                  overlap="circular"
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  badgeContent={
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        bgcolor: getStatusColor(conversation.user.status) + '.main',
                        border: 2,
                        borderColor: 'white',
                      }}
                    />
                  }
                >
                  <Avatar src={conversation.user.profilePicture}>
                    {conversation.user.username.charAt(0).toUpperCase()}
                  </Avatar>
                </Badge>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle1">
                      {conversation.user.username}
                    </Typography>
                    {conversation.unreadCount > 0 && (
                      <Chip
                        label={conversation.unreadCount}
                        size="small"
                        color="primary"
                      />
                    )}
                  </Box>
                }
                secondary={
                  <Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {conversation.lastMessage?.content || 'No messages yet'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {conversation.lastMessage?.createdAt
                        ? formatLastSeen(conversation.lastMessage.createdAt)
                        : formatLastSeen(conversation.user.lastSeen)}
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
            ))}
          </List>
        )}
      </Box>

      {/* Footer */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Fab
          color="primary"
          size="medium"
          onClick={() => setSearchOpen(true)}
          className="btn-3d ripple floating neon-glow"
          sx={{ 
            width: '100%', 
            borderRadius: '15px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: '#667eea',
            '&:hover': {
              background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
              transform: 'translateY(-5px) rotateX(5deg) scale(1.05)',
              boxShadow: '0 20px 60px rgba(102, 126, 234, 0.5)'
            },
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <Add sx={{ color: 'white' }} />
        </Fab>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar */}
      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            position: 'relative',
            height: '100%',
          },
        }}
      >
        {sidebar}
      </Drawer>

      {/* Main Chat Area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedUser ? (
          <ChatWindow
            user={selectedUser}
            onCall={handleCall}
            onBack={() => setSelectedUser(null)}
          />
        ) : (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#f8fafc',
            }}
          >
            {/* Stories Section */}
            <Box
              sx={{
                backgroundColor: 'white',
                borderBottom: '1px solid',
                borderColor: 'divider',
                py: 2,
              }}
            >
              <Stories />
            </Box>
            
            {/* Main Feed Area */}
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                p: 4,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 20%, #f093fb 40%, #f5576c 60%, #4facfe 80%, #00f2fe 100%)',
                backgroundSize: '400% 400%',
                animation: 'gradientAnimation 15s ease infinite',
                '@keyframes gradientAnimation': {
                  '0%': { backgroundPosition: '0% 50%' },
                  '50%': { backgroundPosition: '100% 50%' },
                  '100%': { backgroundPosition: '0% 50%' },
                },
              }}
            >
              {/* Welcome Card */}
              <Box
                sx={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(20px)',
                  borderRadius: 4,
                  p: 6,
                  maxWidth: 500,
                  textAlign: 'center',
                  boxShadow: '0 25px 50px rgba(0, 0, 0, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                }}
              >
                {/* Logo */}
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 3,
                    boxShadow: '0 10px 30px rgba(102, 126, 234, 0.4)',
                    animation: 'logoFloat 4s ease-in-out infinite',
                    '@keyframes logoFloat': {
                      '0%, 100%': { transform: 'translateY(0px) scale(1)' },
                      '50%': { transform: 'translateY(-10px) scale(1.05)' },
                    },
                  }}
                >
                  <Search sx={{ fontSize: 40, color: 'white' }} />
                </Box>
                
                <Typography 
                  variant="h4" 
                  sx={{
                    fontWeight: 700,
                    background: 'linear-gradient(45deg, #667eea, #764ba2)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    mb: 2,
                  }}
                >
                  Welcome to Web Chat
                </Typography>
                
                <Typography 
                  variant="h6" 
                  color="text.secondary" 
                  sx={{ mb: 3, fontWeight: 300 }}
                >
                  by Ankit Kumar
                </Typography>
                
                <Typography 
                  variant="body1" 
                  color="text.secondary" 
                  sx={{ mb: 4, lineHeight: 1.6 }}
                >
                  Connect with friends, share stories, and stay in touch with the people who matter most. 
                  Start a conversation or check out the stories above!
                </Typography>
                
                {/* Action Buttons */}
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={() => setSearchOpen(true)}
                    className="btn-3d ripple bounce"
                    sx={{
                      background: 'linear-gradient(45deg, #667eea, #764ba2)',
                      px: 4,
                      py: 1.5,
                      borderRadius: '15px',
                      textTransform: 'none',
                      fontWeight: 600,
                      boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
                      '&:hover': {
                        background: 'linear-gradient(45deg, #5a67d8, #6b46c1)',
                        boxShadow: '0 20px 60px rgba(102, 126, 234, 0.5)',
                        transform: 'translateY(-5px) rotateX(5deg) scale(1.05)',
                      },
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                    startIcon={<PersonAdd />}
                  >
                    Start New Chat
                  </Button>
                  
                  <Button
                    variant="outlined"
                    size="large"
                    onClick={() => setSettingsOpen(true)}
                    sx={{
                      borderColor: '#667eea',
                      color: '#667eea',
                      px: 4,
                      py: 1.5,
                      borderRadius: 3,
                      textTransform: 'none',
                      fontWeight: 600,
                      '&:hover': {
                        borderColor: '#5a67d8',
                        backgroundColor: 'rgba(102, 126, 234, 0.04)',
                        transform: 'translateY(-2px)',
                      },
                      transition: 'all 0.3s ease',
                    }}
                    startIcon={<Settings />}
                  >
                    Settings
                  </Button>
                  
                  {selectedUser && (
                    <Button
                      variant="outlined"
                      size="medium"
                      onClick={testCallAPI}
                      sx={{
                        borderColor: '#f59e0b',
                        color: '#f59e0b',
                        px: 3,
                        py: 1,
                        borderRadius: 3,
                        textTransform: 'none',
                        fontWeight: 600,
                        '&:hover': {
                          borderColor: '#d97706',
                          backgroundColor: 'rgba(245, 158, 11, 0.04)',
                          transform: 'translateY(-2px)',
                        },
                        transition: 'all 0.3s ease',
                      }}
                      startIcon={<Call />}
                    >
                      Test Call API
                    </Button>
                  )}
                </Box>
              </Box>
            </Box>
          </Box>
        )}
      </Box>

      {/* User Search Dialog */}
      <UserSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onUserSelect={(user) => {
          const chatUser: User = {
            _id: user._id,
            username: user.username,
            email: user.email,
            profilePicture: user.profilePicture,
            status: user.status as 'online' | 'offline' | 'away' | 'busy',
            lastSeen: user.lastSeen
          };
          setSelectedUser(chatUser);
          setSearchOpen(false);
        }}
      />

      {/* Settings Dialog */}
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      {/* Reliable Call Interface */}
      <ReliableCallInterface
        open={callDialog.open}
        type={callDialog.type || 'audio'}
        user={callDialog.user}
        isIncoming={callDialog.isIncoming}
        onEnd={handleCallEnd}
        onAccept={handleCallAccept}
        onReject={handleCallReject}
      />

      {/* Call Notification */}
      <CallNotification
        open={incomingCall.open}
        type={incomingCall.type}
        caller={incomingCall.caller}
        onAccept={handleIncomingCallAccept}
        onReject={handleIncomingCallReject}
      />

      {/* Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={() => setSettingsOpen(true)}>
          <Settings sx={{ mr: 1 }} />
          Settings
        </MenuItem>
        <Divider />
        <MenuItem onClick={logout}>
          <Logout sx={{ mr: 1 }} />
          Logout
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default Chat;
