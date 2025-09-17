const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'login',
      'logout',
      'register',
      'message_sent',
      'message_received',
      'call_initiated',
      'call_received',
      'call_ended',
      'profile_updated',
      'friend_added',
      'friend_removed',
      'user_blocked',
      'user_unblocked',
      'file_uploaded',
      'voice_message_sent',
      'account_banned',
      'account_unbanned',
      'password_changed',
      'email_changed',
      'suspicious_activity'
    ]
  },
  description: {
    type: String,
    required: true
  },
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  metadata: {
    ipAddress: String,
    userAgent: String,
    device: String,
    location: {
      city: String,
      country: String,
      timezone: String
    },
    fileDetails: {
      filename: String,
      size: Number,
      type: String
    },
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    callId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Call'
    },
    duration: Number, // For calls or session duration
    success: Boolean, // For login attempts
    errorMessage: String,
    adminAction: {
      performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      reason: String
    }
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low'
  },
  category: {
    type: String,
    enum: ['authentication', 'messaging', 'calling', 'social', 'security', 'admin', 'system'],
    default: 'system'
  },
  isSystemGenerated: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
activityLogSchema.index({ user: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });
activityLogSchema.index({ severity: 1, createdAt: -1 });
activityLogSchema.index({ category: 1, createdAt: -1 });
activityLogSchema.index({ 'metadata.ipAddress': 1 });
activityLogSchema.index({ targetUser: 1, createdAt: -1 });

// Static method to log activity
activityLogSchema.statics.logActivity = function(data) {
  const {
    user,
    action,
    description,
    targetUser = null,
    metadata = {},
    severity = 'low',
    category = 'system',
    isSystemGenerated = false
  } = data;

  return this.create({
    user,
    action,
    description,
    targetUser,
    metadata,
    severity,
    category,
    isSystemGenerated
  });
};

// Method to get user activity summary
activityLogSchema.statics.getUserActivitySummary = function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$action',
        count: { $sum: 1 },
        lastActivity: { $max: '$createdAt' }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
};

// Method to get security alerts
activityLogSchema.statics.getSecurityAlerts = function(days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.find({
    createdAt: { $gte: startDate },
    $or: [
      { severity: { $in: ['high', 'critical'] } },
      { category: 'security' },
      { action: { $in: ['suspicious_activity', 'account_banned'] } }
    ]
  })
  .populate('user', 'username email')
  .populate('targetUser', 'username email')
  .sort({ createdAt: -1 });
};

module.exports = mongoose.model('ActivityLog', activityLogSchema);