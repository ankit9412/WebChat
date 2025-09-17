const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const passport = require('./config/passport');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const callRoutes = require('./routes/calls');
const adminRoutes = require('./routes/admin');

const app = express();
const server = http.createServer(app);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true
}));

// Rate limiting - more lenient for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // increased limit for development
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => req.ip === '127.0.0.1' || req.ip === '::1' // skip rate limiting for localhost
});
app.use('/api/', limiter);

// Session middleware (required for passport)
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files with proper headers and logging
app.use('/uploads', (req, res, next) => {
  console.log('📁 Static file request:', req.url);
  next();
}, express.static('uploads', {
  setHeaders: (res, filePath) => {
    console.log('📁 Serving file:', filePath);
    
    // Set proper CORS headers for audio files
    res.setHeader('Access-Control-Allow-Origin', process.env.CLIENT_URL || 'http://localhost:3000');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
    
    // Enable range requests for audio files (important for audio playback)
    res.setHeader('Accept-Ranges', 'bytes');
    
    // Set proper content type for audio files
    if (filePath.endsWith('.webm')) {
      res.setHeader('Content-Type', 'audio/webm');
      console.log('🎤 Serving WebM audio file');
    } else if (filePath.endsWith('.wav')) {
      res.setHeader('Content-Type', 'audio/wav');
      console.log('🎤 Serving WAV audio file');
    } else if (filePath.endsWith('.mp3')) {
      res.setHeader('Content-Type', 'audio/mpeg');
      console.log('🎤 Serving MP3 audio file');
    } else if (filePath.endsWith('.m4a')) {
      res.setHeader('Content-Type', 'audio/mp4');
      console.log('🎤 Serving M4A audio file');
    } else if (filePath.endsWith('.ogg')) {
      res.setHeader('Content-Type', 'audio/ogg');
      console.log('🎤 Serving OGG audio file');
    }
    
    // Cache control for audio files
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
  },
  // Add fallback for missing files
  fallthrough: false
}));

// Handle missing static files
app.use('/uploads', (req, res) => {
  console.error('❌ Static file not found:', req.url);
  res.status(404).json({ error: 'File not found' });
});

// Database connection with error handling
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/webchat', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('✅ MongoDB connected successfully');
}).catch((err) => {
  console.error('❌ MongoDB connection error:', err.message);
  console.log('⚠️ Continuing without MongoDB for testing...');
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/admin', adminRoutes);

// Socket.io setup
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Make io available to routes
app.set('io', io);

// Global call room management (shared across all sockets)
const activeCallRooms = new Map();
const connectedUsers = new Map(); // Track connected users

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('🔗 User connected:', socket.id);
  console.log('🔐 Socket auth data:', socket.handshake.auth);
  
  // Store user info on socket
  let currentUserId = null;
  
  // Try to auto-join user room from auth data
  const authUserId = socket.handshake.auth?.userId;
  if (authUserId) {
    console.log('🎉 Auto-joining user room from auth:', authUserId);
    currentUserId = authUserId;
    socket.userId = authUserId;
    socket.username = socket.handshake.auth?.username || 'Unknown User';
    socket.join(authUserId);
    
    // Track connected user
    connectedUsers.set(authUserId, {
      socketId: socket.id,
      username: socket.username,
      connectedAt: new Date()
    });
    
    console.log(`✅ User ${authUserId} auto-joined their room (socket: ${socket.id})`);
    socket.emit('room-joined', { userId: authUserId, socketId: socket.id });
  }

  // Join user to their personal room
  socket.on('join-user', (data) => {
    const userId = data.userId || data;
    const username = data.username || 'Unknown User';
    
    console.log('🔗 Join-user event received:', { userId, username, socketId: socket.id });
    if (userId) {
      currentUserId = userId;
      socket.userId = userId;
      socket.username = username;
      socket.join(userId);
      
      // Track connected user
      connectedUsers.set(userId, {
        socketId: socket.id,
        username: username,
        connectedAt: new Date()
      });
      
      console.log(`✅ User ${userId} (${username}) successfully joined their room (socket: ${socket.id})`);
      
      // Confirm room join to client
      socket.emit('room-joined', { userId, socketId: socket.id });
    } else {
      console.warn('⚠️ Attempted to join room with null userId, socket:', socket.id);
      socket.emit('join-error', { error: 'Invalid userId' });
    }
  });

  // Join chat room
  socket.on('join-chat', (chatId) => {
    socket.join(chatId);
    console.log(`User joined chat: ${chatId}`);
  });

  // Leave chat room
  socket.on('leave-chat', (chatId) => {
    socket.leave(chatId);
    console.log(`User left chat: ${chatId}`);
  });

  // Handle new message
  socket.on('send-message', (data) => {
    // Emit to both sender and receiver
    const { senderId, receiverId, message } = data;
    
    // Emit to receiver's room
    socket.to(receiverId).emit('new-message', message);
    
    // Emit to sender's room (for multiple devices)
    socket.to(senderId).emit('new-message', message);
    
    // Also emit back to sender's current socket
    socket.emit('message-sent', message);
  });

  // Handle typing indicators
  socket.on('typing', (data) => {
    const { userId, receiverId, username } = data;
    socket.to(receiverId).emit('user-typing', { userId, username, isTyping: true });
  });

  socket.on('stop-typing', (data) => {
    const { userId, receiverId, username } = data;
    socket.to(receiverId).emit('user-stop-typing', { userId, username, isTyping: false });
  });

  // RELIABLE CALL SYSTEM - Simplified and working
  
  // Simple call initiation
  socket.on('initiate-call', (data) => {
    const { to, type, callerName } = data;
    const callerId = socket.userId;
    const callerUsername = socket.username || callerName || 'Unknown User';
    
    console.log('📞 RELIABLE: Call initiated:', {
      from: callerId,
      to: to,
      type: type,
      callerName: callerUsername
    });
    
    // Validate caller is authenticated
    if (!callerId) {
      socket.emit('call-failed', { error: 'Not authenticated' });
      return;
    }
    
    // Check if target user is online
    const targetSockets = io.sockets.adapter.rooms.get(to);
    const isTargetOnline = targetSockets && targetSockets.size > 0;
    
    if (!isTargetOnline) {
      console.warn('⚠️ RELIABLE: Target user not online:', to);
      socket.emit('call-failed', { error: 'User is not online' });
      return;
    }
    
    // Send incoming call notification
    socket.to(to).emit('incoming-call', {
      type: type,
      from: callerId,
      caller: {
        _id: callerId,
        username: callerUsername,
        email: socket.handshake.auth?.email || ''
      }
    });
    
    console.log('📤 RELIABLE: Incoming call sent to:', to);
  });

  // Enhanced call acceptance
  socket.on('accept-call', (data) => {
    const { from, roomId } = data;
    const acceptedBy = socket.userId;
    const acceptorUsername = socket.username || 'Unknown User';
    
    console.log('✅ Enhanced call accepted:', {
      from: from,
      acceptedBy: acceptedBy,
      acceptorName: acceptorUsername,
      roomId: roomId
    });
    
    // Validate acceptor is authenticated
    if (!acceptedBy) {
      socket.emit('call-error', {
        error: 'Not authenticated',
        code: 'AUTH_REQUIRED'
      });
      return;
    }
    
    // Update call room status
    if (activeCallRooms.has(roomId)) {
      const callRoom = activeCallRooms.get(roomId);
      
      // Validate this user is the intended callee
      if (callRoom.callee !== acceptedBy) {
        console.warn('⚠️ Call acceptance from wrong user:', {
          expected: callRoom.callee,
          actual: acceptedBy,
          roomId: roomId
        });
        socket.emit('call-error', {
          error: 'Not authorized to accept this call',
          code: 'UNAUTHORIZED'
        });
        return;
      }
      
      callRoom.status = 'accepted';
      callRoom.acceptTime = new Date();
      callRoom.acceptorInfo = {
        id: acceptedBy,
        username: acceptorUsername
      };
      
      // Join callee to room
      socket.join(roomId);
      
      console.log('🏠 Call room updated - both participants in room:', roomId);
      
      // Notify caller with acceptor info
      socket.to(from).emit('call-accepted', {
        acceptedBy: acceptedBy,
        acceptorName: acceptorUsername,
        roomId: roomId,
        timestamp: new Date().toISOString()
      });
      
      // Also notify all participants in the room
      io.to(roomId).emit('call-room-ready', {
        roomId: roomId,
        participants: [callRoom.caller, callRoom.callee],
        status: 'accepted',
        timestamp: new Date().toISOString()
      });
      
      console.log('📤 Call acceptance sent to caller:', from, 'by:', acceptorUsername);
    } else {
      console.warn('⚠️ Call room not found:', roomId);
      socket.emit('call-error', {
        error: 'Call room not found or expired',
        roomId: roomId,
        code: 'ROOM_NOT_FOUND'
      });
    }
  });

  // Enhanced call rejection
  socket.on('reject-call', (data) => {
    const { from, roomId } = data;
    const rejectedBy = socket.userId;
    
    console.log('❌ Enhanced call rejected:', {
      from: from,
      rejectedBy: rejectedBy,
      roomId: roomId
    });
    
    // Clean up call room
    if (activeCallRooms.has(roomId)) {
      activeCallRooms.delete(roomId);
      
      // Notify caller
      socket.to(from).emit('call-rejected', {
        rejectedBy: rejectedBy,
        roomId: roomId,
        timestamp: new Date().toISOString()
      });
      
      // Leave room
      socket.leave(roomId);
      
      console.log('📤 Call rejection sent to caller:', from);
    }
  });

  // Enhanced call ending
  socket.on('end-call', (data) => {
    const { to, roomId } = data;
    const endedBy = socket.userId;
    
    console.log('📞 Enhanced call ended:', {
      to: to,
      endedBy: endedBy,
      roomId: roomId
    });
    
    // Find and clean up call room
    let targetRoomId = roomId;
    if (!targetRoomId) {
      // Find room by participants
      for (let [rId, room] of activeCallRooms) {
        if ((room.caller === endedBy && room.callee === to) || 
            (room.caller === to && room.callee === endedBy)) {
          targetRoomId = rId;
          break;
        }
      }
    }
    
    if (targetRoomId && activeCallRooms.has(targetRoomId)) {
      const callRoom = activeCallRooms.get(targetRoomId);
      callRoom.status = 'ended';
      callRoom.endTime = new Date();
      
      // Notify other participant
      socket.to(to).emit('call-ended', {
        endedBy: endedBy,
        roomId: targetRoomId,
        timestamp: new Date().toISOString()
      });
      
      // Clean up room
      activeCallRooms.delete(targetRoomId);
      socket.leave(targetRoomId);
      
      console.log('📤 Call end notification sent to:', to);
    }
  });
  
  // SIMPLE WORKING CALL HANDLERS (was Legacy)
  socket.on('call-user', (data) => {
    console.log('📞 SIMPLE: Call from', socket.userId, 'to', data.to, 'type:', data.type);
    
    // Just forward the call to the target user
    socket.to(data.to).emit('incoming-call', {
      type: data.type,
      caller: data.caller
    });
    
    console.log('📤 SIMPLE: Call forwarded to', data.to);
  });

  socket.on('call-accepted', (data) => {
    console.log('✅ SIMPLE: Call accepted by', socket.userId, 'for', data.to);
    
    socket.to(data.to).emit('call-accepted', {
      type: data.type,
      acceptedBy: socket.userId
    });
  });

  socket.on('call-rejected', (data) => {
    console.log('❌ SIMPLE: Call rejected by', socket.userId, 'for', data.to);
    
    socket.to(data.to).emit('call-rejected', {
      rejectedBy: socket.userId
    });
  });

  socket.on('call-ended', (data) => {
    console.log('📞 SIMPLE: Call ended by', socket.userId, 'for', data.to);
    
    socket.to(data.to).emit('call-ended', {
      endedBy: socket.userId
    });
  });

  // RELIABLE WebRTC signaling - Simplified and working
  socket.on('webrtc-signal', (data) => {
    const signalFrom = socket.userId;
    
    console.log('📡 RELIABLE: WebRTC signal:', {
      type: data.type,
      to: data.to,
      from: signalFrom,
      hasOffer: data.type === 'offer' && !!data.offer,
      hasAnswer: data.type === 'answer' && !!data.answer,
      hasCandidate: data.type === 'ice-candidate' && !!data.candidate
    });
    
    // Validate sender is authenticated
    if (!signalFrom) {
      socket.emit('webrtc-error', { error: 'Not authenticated' });
      return;
    }
    
    // Check if target user is online
    if (data.to) {
      const targetSockets = io.sockets.adapter.rooms.get(data.to);
      const isTargetOnline = targetSockets && targetSockets.size > 0;
      
      if (isTargetOnline) {
        // Forward the signal to the target user
        const signal = {
          ...data,
          from: signalFrom
        };
        
        socket.to(data.to).emit('webrtc-signal', signal);
        console.log('✅ RELIABLE: WebRTC signal forwarded to:', data.to);
      } else {
        console.warn('⚠️ RELIABLE: Target user not online for WebRTC signal:', data.to);
        socket.emit('webrtc-error', { error: 'Target user is not online' });
      }
    } else {
      console.warn('⚠️ RELIABLE: WebRTC signal missing target user ID');
      socket.emit('webrtc-error', { error: 'Missing target user ID' });
    }
  });

  // Handle message status updates
  socket.on('message-delivered', (data) => {
    const { messageId, receiverId, senderId } = data;
    // Update message status in database and notify sender
    socket.to(senderId).emit('message-delivered', { messageId, status: 'delivered' });
  });

  socket.on('message-read', (data) => {
    const { messageId, receiverId, senderId } = data;
    // Update message status in database and notify sender
    socket.to(senderId).emit('message-read', { messageId, status: 'read' });
  });

  socket.on('mark-messages-read', (data) => {
    const { conversationWith, readBy } = data;
    // Notify the other user that messages have been read
    socket.to(conversationWith).emit('conversation-read', { readBy });
  });

  // Enhanced disconnect handling with call room cleanup
  socket.on('disconnect', () => {
    console.log('🔌 User disconnected:', {
      socketId: socket.id,
      userId: socket.userId,
      username: socket.username
    });
    
    // Clean up connected user tracking
    if (socket.userId) {
      connectedUsers.delete(socket.userId);
      console.log('🧹 Removed user from connected users:', socket.userId);
    }
    
    // Clean up any active call rooms for this user
    const userCallRooms = [];
    for (let [roomId, room] of activeCallRooms) {
      if (room.caller === socket.userId || room.callee === socket.userId) {
        userCallRooms.push({ roomId, room });
      }
    }
    
    // Notify participants and clean up rooms
    for (let { roomId, room } of userCallRooms) {
      const otherUserId = room.caller === socket.userId ? room.callee : room.caller;
      
      // Notify the other participant that the call ended
      socket.to(otherUserId).emit('call-ended', {
        endedBy: socket.userId,
        reason: 'disconnect',
        roomId: roomId,
        timestamp: new Date().toISOString()
      });
      
      // Remove the room
      activeCallRooms.delete(roomId);
      console.log('🧹 Cleaned up call room on disconnect:', roomId);
    }
    
    if (userCallRooms.length > 0) {
      console.log(`📤 Notified ${userCallRooms.length} call participants about disconnect`);
    }
    
    // Log current active state
    console.log('📈 Current active state:', {
      connectedUsers: connectedUsers.size,
      activeCallRooms: activeCallRooms.size
    });
  });
  
  // Call room statistics endpoint (for debugging)
  socket.on('get-call-stats', () => {
    const stats = {
      activeRooms: activeCallRooms.size,
      rooms: Array.from(activeCallRooms.entries()).map(([id, room]) => ({
        roomId: id,
        participants: [room.caller, room.callee],
        status: room.status,
        type: room.type,
        duration: room.connectTime 
          ? Math.floor((new Date() - room.connectTime) / 1000)
          : null,
        startTime: room.startTime
      }))
    };
    
    socket.emit('call-stats', stats);
    console.log('📊 Call stats requested:', stats);
  });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, (err) => {
  if (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 API available at: http://localhost:${PORT}/api`);
  console.log(`🔌 Socket.IO ready for connections`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('📴 Received SIGTERM, shutting down gracefully');
  server.close(async () => {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('📴 Received SIGINT, shutting down gracefully');
  server.close(async () => {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
    process.exit(0);
  });
});
