const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: function() {
      return !this.attachment && !this.voiceNote;
    }
  },
  type: {
    type: String,
    enum: ['text', 'image', 'file', 'voice', 'video', 'call', 'system'],
    default: 'text'
  },
  attachment: {
    url: String,
    filename: String,
    size: Number,
    mimeType: String
  },
  voiceNote: {
    url: String,
    duration: Number,
    waveform: [Number] // For audio visualization
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    emoji: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  },
  deliveredAt: Date,
  readAt: Date,
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: Date,
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  metadata: {
    isForwarded: { type: Boolean, default: false },
    forwardedFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    location: {
      latitude: Number,
      longitude: Number,
      address: String
    }
  }
}, {
  timestamps: true
});

// Index for efficient querying
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
messageSchema.index({ createdAt: -1 });

// Virtual for IST timestamp
messageSchema.virtual('istTimestamp').get(function() {
  const moment = require('moment-timezone');
  return moment(this.createdAt).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
});

// Method to mark as read
messageSchema.methods.markAsRead = function() {
  this.status = 'read';
  this.readAt = new Date();
  return this.save();
};

// Method to mark as delivered
messageSchema.methods.markAsDelivered = function() {
  if (this.status === 'sent') {
    this.status = 'delivered';
    this.deliveredAt = new Date();
  }
  return this.save();
};

// Method to add reaction
messageSchema.methods.addReaction = function(userId, emoji) {
  // Remove existing reaction from this user
  this.reactions = this.reactions.filter(r => !r.user.equals(userId));
  
  // Add new reaction
  this.reactions.push({
    user: userId,
    emoji: emoji,
    timestamp: new Date()
  });
  
  return this.save();
};

// Method to remove reaction
messageSchema.methods.removeReaction = function(userId) {
  this.reactions = this.reactions.filter(r => !r.user.equals(userId));
  return this.save();
};

module.exports = mongoose.model('Message', messageSchema);
