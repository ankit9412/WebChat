const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const Message = require('../models/Message');
const User = require('../models/User');

const router = express.Router();

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, config.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: config.MAX_FILE_SIZE
  },
  fileFilter: (req, file, cb) => {
    console.log('🎤 File upload filter - MIME type:', file.mimetype, 'Original name:', file.originalname);
    
    // Special handling for voice files
    if (file.originalname && file.originalname.includes('voice-')) {
      console.log('✅ Voice file detected, allowing upload');
      cb(null, true);
      return;
    }
    
    if (config.ALLOWED_FILE_TYPES.includes(file.mimetype)) {
      console.log('✅ File type allowed:', file.mimetype);
      cb(null, true);
    } else {
      console.error('❌ Invalid file type:', file.mimetype);
      cb(new Error(`Invalid file type: ${file.mimetype}`), false);
    }
  }
});

// Send message
router.post('/send', authenticateToken, async (req, res) => {
  try {
    const { receiver, content, type = 'text', replyTo } = req.body;

    if (!receiver || !content) {
      return res.status(400).json({ message: 'Receiver and content are required' });
    }

    // Check if receiver exists and is not blocked
    const receiverUser = await User.findById(receiver);
    if (!receiverUser) {
      return res.status(404).json({ message: 'Receiver not found' });
    }

    const senderUser = await User.findById(req.user.userId);
    if (senderUser.blockedUsers.includes(receiver)) {
      return res.status(403).json({ message: 'Cannot send message to blocked user' });
    }

    const message = new Message({
      sender: req.user.userId,
      receiver,
      content,
      type,
      replyTo
    });

    await message.save();

    // Populate sender info for response
    await message.populate('sender', 'username profilePicture');
    await message.populate('receiver', 'username profilePicture');

    // Broadcast message via Socket.io
    const io = req.app.get('io');
    if (io) {
      console.log('📤 Broadcasting message via Socket.IO:', {
        messageId: message._id,
        from: req.user.userId,
        to: receiver,
        content: message.content.substring(0, 50) + '...'
      });
      
      // Send to receiver's room
      io.to(receiver).emit('new-message', message);
      console.log('📡 Sent to receiver room:', receiver);
      
      // Send to sender's room (for multi-device sync)
      io.to(req.user.userId).emit('new-message', message);
      console.log('📡 Sent to sender room:', req.user.userId);
      
      // Also broadcast to all connected sockets (as fallback)
      io.emit('message-broadcast', {
        senderId: req.user.userId,
        receiverId: receiver,
        message: message
      });
    } else {
      console.warn('⚠️ Socket.IO not available for message broadcasting');
    }

    res.status(201).json(message);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload file and send message
router.post('/send-file', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { receiver, type = 'file', replyTo } = req.body;

    console.log('📤 File upload request:', {
      receiver,
      type,
      file: req.file ? {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        filename: req.file.filename
      } : null
    });

    if (!receiver || !req.file) {
      return res.status(400).json({ message: 'Receiver and file are required' });
    }

    // Check if receiver exists and is not blocked
    const receiverUser = await User.findById(receiver);
    if (!receiverUser) {
      return res.status(404).json({ message: 'Receiver not found' });
    }

    const senderUser = await User.findById(req.user.userId);
    if (senderUser.blockedUsers.includes(receiver)) {
      return res.status(403).json({ message: 'Cannot send message to blocked user' });
    }

    // Set appropriate content for voice messages
    let messageContent = '';
    if (type === 'voice') {
      const duration = Math.floor(req.file.size / 16000) || 5; // Rough estimate
      messageContent = `🎤 Voice message (${duration}s)`;
      
      // Validate audio file exists and is readable
      const filePath = path.join('uploads', req.file.filename);
      if (!fs.existsSync(filePath)) {
        console.error('❌ Audio file was not saved properly:', filePath);
        return res.status(500).json({ message: 'Audio file upload failed' });
      }
      
      const fileStats = fs.statSync(filePath);
      console.log('🎤 Audio file validation:', {
        path: filePath,
        size: fileStats.size,
        exists: true,
        mimeType: req.file.mimetype
      });
      
      if (fileStats.size === 0) {
        console.error('❌ Audio file is empty:', filePath);
        return res.status(500).json({ message: 'Audio file is empty' });
      }
    }
    
    const message = new Message({
      sender: req.user.userId,
      receiver,
      content: messageContent,
      type,
      attachment: {
        url: `/uploads/${req.file.filename}`,
        filename: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype
      },
      replyTo
    });

    await message.save();
    await message.populate('sender', 'username profilePicture');
    await message.populate('receiver', 'username profilePicture');

    // Broadcast message via Socket.io
    const io = req.app.get('io');
    if (io) {
      // Send to receiver
      io.to(receiver).emit('new-message', message);
      // Send to sender (for multi-device sync)
      io.to(req.user.userId).emit('new-message', message);
    }

    res.status(201).json(message);
  } catch (error) {
    console.error('Send file error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get messages between two users
router.get('/conversation/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const skip = (page - 1) * limit;

    const messages = await Message.find({
      $or: [
        { sender: req.user.userId, receiver: userId },
        { sender: userId, receiver: req.user.userId }
      ]
    })
    .populate('sender', 'username profilePicture')
    .populate('receiver', 'username profilePicture')
    .populate('replyTo')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    res.json(messages.reverse());
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark messages as read
router.put('/mark-read/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await Message.updateMany(
      {
        sender: userId,
        receiver: req.user.userId,
        status: { $ne: 'read' }
      },
      { 
        status: 'read',
        readAt: new Date()
      }
    );

    // Broadcast status update via Socket.io
    const io = req.app.get('io');
    if (io && result.modifiedCount > 0) {
      io.to(userId).emit('messages-read', {
        readBy: req.user.userId,
        conversationWith: userId
      });
    }

    res.json({ message: 'Messages marked as read', updated: result.modifiedCount });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark message as delivered (called when message is received)
router.put('/mark-delivered/:messageId', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Only mark as delivered if current status is 'sent'
    if (message.status === 'sent') {
      await message.markAsDelivered();
      
      // Broadcast status update via Socket.io
      const io = req.app.get('io');
      if (io) {
        io.to(message.sender.toString()).emit('message-delivered', {
          messageId: message._id,
          status: 'delivered',
          deliveredAt: message.deliveredAt
        });
      }
    }

    res.json({ message: 'Message marked as delivered', status: message.status });
  } catch (error) {
    console.error('Mark delivered error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark specific message as read
router.put('/mark-read-message/:messageId', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Only mark as read if not already read and user is the receiver
    if (message.receiver.toString() === req.user.userId && message.status !== 'read') {
      await message.markAsRead();
      
      // Broadcast status update via Socket.io
      const io = req.app.get('io');
      if (io) {
        io.to(message.sender.toString()).emit('message-read', {
          messageId: message._id,
          status: 'read',
          readAt: message.readAt
        });
      }
    }

    res.json({ message: 'Message marked as read', status: message.status });
  } catch (error) {
    console.error('Mark message read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add reaction to message
router.post('/:messageId/reaction', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({ message: 'Emoji is required' });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    await message.addReaction(req.user.userId, emoji);
    await message.populate('reactions.user', 'username');

    res.json(message);
  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove reaction from message
router.delete('/:messageId/reaction', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    await message.removeReaction(req.user.userId);
    await message.populate('reactions.user', 'username');

    res.json(message);
  } catch (error) {
    console.error('Remove reaction error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Edit message
router.put('/:messageId', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ message: 'Content is required' });
    }

    const message = await Message.findOne({
      _id: messageId,
      sender: req.user.userId
    });

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    message.content = content;
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    await message.populate('sender', 'username profilePicture');

    res.json(message);
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete message
router.delete('/:messageId', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findOne({
      _id: messageId,
      sender: req.user.userId
    });

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    await message.save();

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get recent conversations - BULLETPROOF VERSION
router.get('/conversations/recent', authenticateToken, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    
    console.log('🚯 BULLETPROOF CONVERSATION FETCH FOR USER:', req.user.userId);
    
    // Step 1: Get all unique conversation partners
    const conversationPartners = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: userId },
            { receiver: userId }
          ],
          isDeleted: { $ne: true }
        }
      },
      {
        $project: {
          conversationPartner: {
            $cond: [
              { $eq: ['$sender', userId] },
              '$receiver',
              '$sender'
            ]
          }
        }
      },
      {
        $group: {
          _id: '$conversationPartner'
        }
      }
    ]);
    
    console.log('🚯 FOUND', conversationPartners.length, 'UNIQUE CONVERSATION PARTNERS');
    
    // Step 2: For each unique partner, get the latest message and details
    const conversations = [];
    
    for (const partner of conversationPartners) {
      const partnerId = partner._id;
      
      // Get the most recent message with this partner
      const lastMessage = await Message.findOne({
        $or: [
          { sender: userId, receiver: partnerId },
          { sender: partnerId, receiver: userId }
        ],
        isDeleted: { $ne: true }
      })
      .sort({ createdAt: -1 })
      .populate('sender', 'username profilePicture')
      .populate('receiver', 'username profilePicture');
      
      if (!lastMessage) continue;
      
      // Get unread count
      const unreadCount = await Message.countDocuments({
        sender: partnerId,
        receiver: userId,
        status: { $ne: 'read' },
        isDeleted: { $ne: true }
      });
      
      // Get user details
      const partnerUser = await User.findById(partnerId).select('username email profilePicture status lastSeen');
      
      if (!partnerUser) continue;
      
      const conversation = {
        user: {
          _id: partnerUser._id,
          username: partnerUser.username,
          email: partnerUser.email,
          profilePicture: partnerUser.profilePicture,
          status: partnerUser.status,
          lastSeen: partnerUser.lastSeen
        },
        lastMessage: {
          _id: lastMessage._id,
          content: lastMessage.content,
          type: lastMessage.type,
          createdAt: lastMessage.createdAt,
          status: lastMessage.status
        },
        unreadCount: unreadCount
      };
      
      conversations.push(conversation);
    }
    
    // Sort by most recent message
    conversations.sort((a, b) => 
      new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
    );
    
    console.log('🚯 BULLETPROOF RESULT:', conversations.length, 'GUARANTEED UNIQUE CONVERSATIONS');
    
    // Final safety check - remove any possible duplicates by user ID
    const finalUniqueConversations = [];
    const seenUserIds = new Set();
    
    for (const conv of conversations) {
      const userIdStr = conv.user._id.toString();
      if (!seenUserIds.has(userIdStr)) {
        seenUserIds.add(userIdStr);
        finalUniqueConversations.push(conv);
        console.log('🚯 ADDED UNIQUE CONVERSATION:', conv.user.username);
      } else {
        console.log('🚫 BLOCKED DUPLICATE CONVERSATION:', conv.user.username);
      }
    }
    
    console.log('💫 FINAL UNIQUE COUNT:', finalUniqueConversations.length);

    res.json(finalUniqueConversations);
  } catch (error) {
    console.error('Get recent conversations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
