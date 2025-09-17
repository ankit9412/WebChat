const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const User = require('../models/User');

const router = express.Router();

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/avatars/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

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

// Upload profile picture
router.post('/upload-avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete old profile picture if exists
    if (user.profilePicture && user.profilePicture.includes('/avatars/')) {
      const oldPicturePath = path.join(__dirname, '..', user.profilePicture);
      if (fs.existsSync(oldPicturePath)) {
        fs.unlinkSync(oldPicturePath);
      }
    }

    // Update user profile picture
    user.profilePicture = `/uploads/avatars/${req.file.filename}`;
    await user.save();

    res.json({
      message: 'Profile picture updated successfully',
      profilePicture: user.profilePicture
    });
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password -securityAlerts');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { username, profilePicture, preferences } = req.body;
    const updates = {};

    if (username) {
      // Check if username is already taken
      const existingUser = await User.findOne({ 
        username, 
        _id: { $ne: req.user.userId } 
      });
      
      if (existingUser) {
        return res.status(400).json({ message: 'Username already taken' });
      }
      updates.username = username;
    }

    if (profilePicture) {
      updates.profilePicture = profilePicture;
    }

    if (preferences) {
      updates.preferences = { ...updates.preferences, ...preferences };
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      updates,
      { new: true, select: '-password -securityAlerts' }
    );

    res.json(user);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search users
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters' });
    }

    const users = await User.find({
      $and: [
        { _id: { $ne: req.user.userId } }, // Exclude current user
        { isEmailVerified: true },
        {
          $or: [
            { username: { $regex: query, $options: 'i' } },
            { email: { $regex: query, $options: 'i' } }
          ]
        }
      ]
    }).select('username email profilePicture status lastSeen').limit(20);

    res.json(users);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add friend
router.post('/friends/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (userId === req.user.userId) {
      return res.status(400).json({ message: 'Cannot add yourself as friend' });
    }

    const user = await User.findById(req.user.userId);
    const friend = await User.findById(userId);

    if (!friend) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.friends.includes(userId)) {
      return res.status(400).json({ message: 'User is already your friend' });
    }

    user.friends.push(userId);
    await user.save();

    res.json({ message: 'Friend added successfully' });
  } catch (error) {
    console.error('Add friend error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove friend
router.delete('/friends/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(req.user.userId);
    user.friends = user.friends.filter(id => !id.equals(userId));
    await user.save();

    res.json({ message: 'Friend removed successfully' });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get friends list
router.get('/friends', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .populate('friends', 'username email profilePicture status lastSeen');

    res.json(user.friends);
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Block user
router.post('/block/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (userId === req.user.userId) {
      return res.status(400).json({ message: 'Cannot block yourself' });
    }

    const user = await User.findById(req.user.userId);
    const userToBlock = await User.findById(userId);

    if (!userToBlock) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Remove from friends if they are friends
    user.friends = user.friends.filter(id => !id.equals(userId));
    
    // Add to blocked users
    if (!user.blockedUsers.includes(userId)) {
      user.blockedUsers.push(userId);
    }
    
    await user.save();

    res.json({ message: 'User blocked successfully' });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Unblock user
router.delete('/block/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(req.user.userId);
    user.blockedUsers = user.blockedUsers.filter(id => !id.equals(userId));
    await user.save();

    res.json({ message: 'User unblocked successfully' });
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user status
router.put('/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['online', 'offline', 'away', 'busy'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { 
        status,
        lastSeen: new Date()
      },
      { new: true, select: '-password -securityAlerts' }
    );

    res.json(user);
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user by ID
router.get('/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId)
      .select('username email profilePicture status lastSeen preferences.privacy');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user is blocked
    const currentUser = await User.findById(req.user.userId);
    if (currentUser.blockedUsers.includes(userId)) {
      return res.status(403).json({ message: 'User is blocked' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
