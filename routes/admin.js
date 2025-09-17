const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const Message = require('../models/Message');
const Call = require('../models/Call');
const ActivityLog = require('../models/ActivityLog');

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

// Middleware to verify admin access
const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || !user.isAdmin()) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    req.adminUser = user;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get admin dashboard stats
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const stats = {
      users: {
        total: await User.countDocuments(),
        active: await User.countDocuments({ status: { $in: ['online', 'away'] } }),
        banned: await User.countDocuments({ isBanned: true }),
        new: await User.countDocuments({ 
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
        })
      },
      messages: {
        total: await Message.countDocuments(),
        today: await Message.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }),
        thisWeek: await Message.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        })
      },
      calls: {
        total: await Call.countDocuments(),
        today: await Call.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }),
        thisWeek: await Call.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        })
      },
      activities: {
        total: await ActivityLog.countDocuments(),
        security: await ActivityLog.countDocuments({ 
          category: 'security',
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }),
        critical: await ActivityLog.countDocuments({ 
          severity: 'critical',
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        })
      }
    };

    res.json(stats);
  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all users with pagination and search
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status = '', role = '' } = req.query;
    const skip = (page - 1) * limit;

    // Build query
    const query = {};
    
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) {
      if (status === 'banned') {
        query.isBanned = true;
      } else {
        query.status = status;
        query.isBanned = { $ne: true };
      }
    }
    
    if (role) {
      query.role = role;
    }

    const users = await User.find(query)
      .select('-password -emailVerificationToken')
      .populate('bannedBy', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user details with activity
router.get('/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .select('-password -emailVerificationToken')
      .populate('bannedBy', 'username email')
      .populate('friends', 'username email profilePicture')
      .populate('blockedUsers', 'username email');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user activity summary
    const activitySummary = await ActivityLog.getUserActivitySummary(userId);
    
    // Get recent activities
    const recentActivities = await ActivityLog.find({ user: userId })
      .populate('targetUser', 'username email')
      .sort({ createdAt: -1 })
      .limit(20);

    // Get user stats
    const stats = {
      messagesSent: await Message.countDocuments({ sender: userId }),
      messagesReceived: await Message.countDocuments({ receiver: userId }),
      callsInitiated: await Call.countDocuments({ caller: userId }),
      callsReceived: await Call.countDocuments({ receiver: userId }),
      friendsCount: user.friends.length,
      blockedUsersCount: user.blockedUsers.length,
      lastActivity: await ActivityLog.findOne({ user: userId }).sort({ createdAt: -1 })
    };

    res.json({
      user,
      activitySummary,
      recentActivities,
      stats
    });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Ban user
router.post('/users/:userId/ban', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, duration } = req.body; // duration in milliseconds

    if (!reason) {
      return res.status(400).json({ message: 'Ban reason is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isAdmin()) {
      return res.status(403).json({ message: 'Cannot ban admin users' });
    }

    await user.banUser(reason, req.user.userId, duration);

    // Log the action
    await ActivityLog.logActivity({
      user: req.user.userId,
      action: 'account_banned',
      description: `Banned user ${user.username}`,
      targetUser: userId,
      metadata: {
        adminAction: {
          performedBy: req.user.userId,
          reason: reason
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      },
      severity: 'high',
      category: 'admin'
    });

    // Broadcast ban status via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(userId).emit('account-banned', {
        reason,
        bannedBy: req.adminUser.username,
        bannedAt: user.bannedAt,
        expiresAt: user.banExpiresAt
      });
    }

    res.json({ message: 'User banned successfully', user: user });
  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Unban user
router.post('/users/:userId/unban', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.isBanned) {
      return res.status(400).json({ message: 'User is not banned' });
    }

    await user.unbanUser();

    // Log the action
    await ActivityLog.logActivity({
      user: req.user.userId,
      action: 'account_unbanned',
      description: `Unbanned user ${user.username}`,
      targetUser: userId,
      metadata: {
        adminAction: {
          performedBy: req.user.userId
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      },
      severity: 'medium',
      category: 'admin'
    });

    // Broadcast unban status via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(userId).emit('account-unbanned', {
        unbannedBy: req.adminUser.username,
        unbannedAt: new Date()
      });
    }

    res.json({ message: 'User unbanned successfully', user: user });
  } catch (error) {
    console.error('Unban user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get activity logs
router.get('/activities', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      category = '', 
      severity = '', 
      action = '',
      userId = '',
      startDate = '',
      endDate = ''
    } = req.query;
    
    const skip = (page - 1) * limit;

    // Build query
    const query = {};
    
    if (category) query.category = category;
    if (severity) query.severity = severity;
    if (action) query.action = action;
    if (userId) query.user = userId;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const activities = await ActivityLog.find(query)
      .populate('user', 'username email profilePicture')
      .populate('targetUser', 'username email')
      .populate('metadata.adminAction.performedBy', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ActivityLog.countDocuments(query);

    res.json({
      activities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get security alerts
router.get('/security-alerts', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const alerts = await ActivityLog.getSecurityAlerts(parseInt(days));
    res.json(alerts);
  } catch (error) {
    console.error('Get security alerts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user role
router.put('/users/:userId/role', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['user', 'admin', 'moderator'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const oldRole = user.role;
    user.role = role;
    await user.save();

    // Log the action
    await ActivityLog.logActivity({
      user: req.user.userId,
      action: 'role_changed',
      description: `Changed role of ${user.username} from ${oldRole} to ${role}`,
      targetUser: userId,
      metadata: {
        adminAction: {
          performedBy: req.user.userId,
          reason: `Role change from ${oldRole} to ${role}`
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      },
      severity: 'high',
      category: 'admin'
    });

    res.json({ message: 'User role updated successfully', user });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete user account (soft delete)
router.delete('/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isAdmin()) {
      return res.status(403).json({ message: 'Cannot delete admin users' });
    }

    // Mark user as deleted and ban permanently
    await user.banUser(reason || 'Account deleted by admin', req.user.userId);
    user.status = 'offline';
    await user.save();

    // Log the action
    await ActivityLog.logActivity({
      user: req.user.userId,
      action: 'account_deleted',
      description: `Deleted account of ${user.username}`,
      targetUser: userId,
      metadata: {
        adminAction: {
          performedBy: req.user.userId,
          reason: reason || 'Account deleted by admin'
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      },
      severity: 'critical',
      category: 'admin'
    });

    res.json({ message: 'User account deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all messages with pagination and filters
router.get('/messages', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      search = '', 
      type = '',
      senderId = '',
      receiverId = '',
      startDate = '',
      endDate = ''
    } = req.query;
    
    const skip = (page - 1) * limit;

    // Build query
    const query = {};
    
    if (search) {
      query.content = { $regex: search, $options: 'i' };
    }
    
    if (type) {
      query.type = type;
    }
    
    if (senderId) {
      query.sender = senderId;
    }
    
    if (receiverId) {
      query.receiver = receiverId;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const messages = await Message.find(query)
      .populate('sender', 'username email profilePicture')
      .populate('receiver', 'username email profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Message.countDocuments(query);

    res.json({
      messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete message (admin)
router.delete('/messages/:messageId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { reason = 'Inappropriate content' } = req.body;

    const message = await Message.findById(messageId)
      .populate('sender', 'username email')
      .populate('receiver', 'username email');
      
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Mark message as deleted by admin
    message.isDeleted = true;
    message.deletedBy = req.user.userId;
    message.deletedAt = new Date();
    message.deletionReason = reason;
    await message.save();

    // Log the action
    await ActivityLog.logActivity({
      user: req.user.userId,
      action: 'message_deleted',
      description: `Deleted message from ${message.sender.username} to ${message.receiver.username}`,
      targetUser: message.sender._id,
      metadata: {
        messageId: messageId,
        messageContent: message.content.substring(0, 100) + (message.content.length > 100 ? '...' : ''),
        deletionReason: reason,
        adminAction: {
          performedBy: req.user.userId,
          reason: reason
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      },
      severity: 'medium',
      category: 'admin'
    });

    // Broadcast message deletion via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(message.sender._id.toString()).emit('message-deleted', {
        messageId,
        reason,
        deletedBy: req.adminUser.username
      });
      io.to(message.receiver._id.toString()).emit('message-deleted', {
        messageId,
        reason,
        deletedBy: req.adminUser.username
      });
    }

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get conversation between two users
router.get('/conversations/:user1Id/:user2Id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { user1Id, user2Id } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    const skip = (page - 1) * limit;

    const messages = await Message.find({
      $or: [
        { sender: user1Id, receiver: user2Id },
        { sender: user2Id, receiver: user1Id }
      ]
    })
    .populate('sender', 'username email profilePicture')
    .populate('receiver', 'username email profilePicture')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    const total = await Message.countDocuments({
      $or: [
        { sender: user1Id, receiver: user2Id },
        { sender: user2Id, receiver: user1Id }
      ]
    });

    // Get user details
    const user1 = await User.findById(user1Id).select('username email profilePicture');
    const user2 = await User.findById(user2Id).select('username email profilePicture');

    res.json({
      messages: messages.reverse(),
      users: { user1, user2 },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get real-time stats for dashboard
router.get('/realtime-stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
    
    const stats = {
      onlineUsers: await User.countDocuments({ status: 'online' }),
      messagesLastHour: await Message.countDocuments({ createdAt: { $gte: lastHour } }),
      activitiesLastHour: await ActivityLog.countDocuments({ createdAt: { $gte: lastHour } }),
      callsLast24Hours: await Call.countDocuments({ createdAt: { $gte: last24Hours } }),
      criticalAlerts: await ActivityLog.countDocuments({ 
        severity: 'critical',
        createdAt: { $gte: last24Hours }
      }),
      bannedUsersToday: await User.countDocuments({
        isBanned: true,
        bannedAt: { $gte: last24Hours }
      }),
      systemHealth: {
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage()
      }
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Get realtime stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Force logout user (disconnect from all devices)
router.post('/users/:userId/force-logout', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason = 'Administrative action' } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Log the action
    await ActivityLog.logActivity({
      user: req.user.userId,
      action: 'force_logout',
      description: `Force logged out user ${user.username}`,
      targetUser: userId,
      metadata: {
        adminAction: {
          performedBy: req.user.userId,
          reason: reason
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      },
      severity: 'medium',
      category: 'admin'
    });

    // Broadcast force logout via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(userId).emit('force-logout', {
        reason,
        loggedOutBy: req.adminUser.username,
        timestamp: new Date()
      });
    }

    res.json({ message: 'User force logged out successfully' });
  } catch (error) {
    console.error('Force logout error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Clear user's messages (delete all messages from user)
router.delete('/users/:userId/messages', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason = 'Administrative cleanup' } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Mark all messages from this user as deleted
    const result = await Message.updateMany(
      { sender: userId },
      {
        isDeleted: true,
        deletedBy: req.user.userId,
        deletedAt: new Date(),
        deletionReason: reason
      }
    );

    // Log the action
    await ActivityLog.logActivity({
      user: req.user.userId,
      action: 'user_messages_cleared',
      description: `Cleared ${result.modifiedCount} messages from user ${user.username}`,
      targetUser: userId,
      metadata: {
        messagesDeleted: result.modifiedCount,
        adminAction: {
          performedBy: req.user.userId,
          reason: reason
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      },
      severity: 'high',
      category: 'admin'
    });

    res.json({ 
      message: 'User messages cleared successfully',
      deletedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Clear user messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
