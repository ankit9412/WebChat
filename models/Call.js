const mongoose = require('mongoose');

const callSchema = new mongoose.Schema({
  caller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['audio', 'video'],
    required: true
  },
  status: {
    type: String,
    enum: ['initiated', 'ringing', 'answered', 'rejected', 'missed', 'ended'],
    default: 'initiated'
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: Date,
  duration: {
    type: Number, // in seconds
    default: 0
  },
  quality: {
    audio: {
      bitrate: Number,
      packetLoss: Number,
      jitter: Number
    },
    video: {
      resolution: String,
      bitrate: Number,
      framerate: Number
    }
  },
  recording: {
    url: String,
    duration: Number,
    size: Number
  },
  metadata: {
    callerIP: String,
    receiverIP: String,
    userAgent: String,
    networkType: String
  }
}, {
  timestamps: true
});

// Index for efficient querying
callSchema.index({ caller: 1, receiver: 1, createdAt: -1 });
callSchema.index({ status: 1, createdAt: -1 });

// Method to end call
callSchema.methods.endCall = function() {
  this.status = 'ended';
  this.endTime = new Date();
  this.duration = Math.floor((this.endTime - this.startTime) / 1000);
  return this.save();
};

// Method to reject call
callSchema.methods.rejectCall = function() {
  this.status = 'rejected';
  this.endTime = new Date();
  return this.save();
};

// Method to mark as missed
callSchema.methods.markAsMissed = function() {
  this.status = 'missed';
  this.endTime = new Date();
  return this.save();
};

// Virtual for call duration in readable format
callSchema.virtual('durationFormatted').get(function() {
  if (!this.duration) return '00:00';
  
  const hours = Math.floor(this.duration / 3600);
  const minutes = Math.floor((this.duration % 3600) / 60);
  const seconds = this.duration % 60;
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
});

module.exports = mongoose.model('Call', callSchema);
