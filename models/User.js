const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: function() {
      // Password is only required for local auth, not OAuth
      return !this.googleId && !this.facebookId && !this.githubId;
    },
    minlength: 6
  },
  // OAuth provider IDs
  googleId: {
    type: String,
    default: null
  },
  facebookId: {
    type: String,
    default: null
  },
  githubId: {
    type: String,
    default: null
  },
  // Auth provider
  provider: {
    type: String,
    enum: ['local', 'google', 'facebook', 'github'],
    default: 'local'
  },
  // OAuth users are pre-verified
  isVerified: {
    type: Boolean,
    default: false
  },
  avatar: {
    type: String,
    default: null
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    default: null
  },
  emailVerificationCode: {
    type: String,
    default: null
  },
  emailVerificationCodeExpires: {
    type: Date,
    default: null
  },
  emailVerificationAttempts: {
    type: Number,
    default: 0
  },
  profilePicture: {
    type: String,
    default: null
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user'
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'away', 'busy'],
    default: 'offline'
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  isBanned: {
    type: Boolean,
    default: false
  },
  banReason: {
    type: String,
    default: null
  },
  bannedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  bannedAt: {
    type: Date,
    default: null
  },
  banExpiresAt: {
    type: Date,
    default: null
  },
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  lockoutUntil: {
    type: Date,
    default: null
  },
  securityAlerts: [{
    type: {
      type: String,
      enum: ['failed_login', 'suspicious_activity', 'new_device']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    ipAddress: String,
    userAgent: String
  }],
  friends: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'auto'
    },
    notifications: {
      messages: { type: Boolean, default: true },
      calls: { type: Boolean, default: true },
      mentions: { type: Boolean, default: true }
    },
    privacy: {
      showOnlineStatus: { type: Boolean, default: true },
      showLastSeen: { type: Boolean, default: true },
      allowCallsFrom: {
        type: String,
        enum: ['everyone', 'friends', 'none'],
        default: 'friends'
      }
    }
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Skip password hashing for OAuth users or if password not modified
  if (!this.isModified('password') || !this.password) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Check if account is locked
userSchema.methods.isLocked = function() {
  return !!(this.lockoutUntil && this.lockoutUntil > Date.now());
};

// Increment failed login attempts
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockoutUntil && this.lockoutUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockoutUntil: 1 },
      $set: { failedLoginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { failedLoginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.failedLoginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { lockoutUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

// Reset failed login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { failedLoginAttempts: 1, lockoutUntil: 1 }
  });
};

// Add security alert
userSchema.methods.addSecurityAlert = function(type, ipAddress, userAgent) {
  this.securityAlerts.push({
    type,
    ipAddress,
    userAgent,
    timestamp: new Date()
  });
  return this.save();
};

// Check if user is admin
userSchema.methods.isAdmin = function() {
  return this.role === 'admin';
};

// Check if user is moderator or admin
userSchema.methods.isModerator = function() {
  return this.role === 'admin' || this.role === 'moderator';
};

// Ban user
userSchema.methods.banUser = function(reason, bannedBy, duration) {
  this.isBanned = true;
  this.banReason = reason;
  this.bannedBy = bannedBy;
  this.bannedAt = new Date();
  if (duration) {
    this.banExpiresAt = new Date(Date.now() + duration);
  }
  return this.save();
};

// Unban user
userSchema.methods.unbanUser = function() {
  this.isBanned = false;
  this.banReason = null;
  this.bannedBy = null;
  this.bannedAt = null;
  this.banExpiresAt = null;
  return this.save();
};

// Check if ban is expired
userSchema.methods.isBanExpired = function() {
  if (!this.isBanned || !this.banExpiresAt) return false;
  return this.banExpiresAt < new Date();
};

// Generate verification code
userSchema.methods.generateVerificationCode = function() {
  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  this.emailVerificationCode = code;
  this.emailVerificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  this.emailVerificationAttempts = 0;
  return code;
};

// Verify code
userSchema.methods.verifyCode = function(inputCode) {
  if (!this.emailVerificationCode || !this.emailVerificationCodeExpires) {
    return { success: false, message: 'No verification code found' };
  }
  
  if (this.emailVerificationCodeExpires < new Date()) {
    return { success: false, message: 'Verification code has expired' };
  }
  
  if (this.emailVerificationAttempts >= 5) {
    return { success: false, message: 'Too many failed attempts. Please request a new code.' };
  }
  
  if (this.emailVerificationCode !== inputCode) {
    this.emailVerificationAttempts += 1;
    return { success: false, message: 'Invalid verification code' };
  }
  
  return { success: true };
};

// Clear verification data
userSchema.methods.clearVerificationData = function() {
  this.emailVerificationToken = null;
  this.emailVerificationCode = null;
  this.emailVerificationCodeExpires = null;
  this.emailVerificationAttempts = 0;
  this.isEmailVerified = true;
};

module.exports = mongoose.model('User', userSchema);
