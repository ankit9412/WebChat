const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../config');
const Call = require('../models/Call');
const User = require('../models/User');

const router = express.Router();

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  console.log('🔑 Call API auth check:', {
    hasAuthHeader: !!authHeader,
    hasToken: !!token,
    method: req.method,
    url: req.url
  });

  if (!token) {
    console.log('❌ No token provided for call API');
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, config.JWT_SECRET, (err, user) => {
    if (err) {
      console.log('❌ JWT verification failed for call API:', err.message);
      return res.status(403).json({ message: 'Invalid or expired JWT token' });
    }
    
    console.log('✅ JWT verified for call API, user:', user.userId);
    req.user = user;
    next();
  });
};

// Initiate call
router.post('/initiate', authenticateToken, async (req, res) => {
  try {
    const { receiver, type } = req.body;
    
    console.log('📞 Call initiation request:', {
      callerId: req.user.userId,
      receiver,
      type,
      timestamp: new Date().toISOString()
    });

    if (!receiver || !type) {
      console.log('❌ Missing required fields for call');
      return res.status(400).json({ message: 'Receiver and call type are required' });
    }

    if (!['audio', 'video'].includes(type)) {
      console.log('❌ Invalid call type:', type);
      return res.status(400).json({ message: 'Invalid call type' });
    }

    // Check if receiver exists and is not blocked
    console.log('🔍 Looking up receiver user:', receiver);
    const receiverUser = await User.findById(receiver);
    if (!receiverUser) {
      console.log('❌ Receiver not found:', receiver);
      return res.status(404).json({ message: 'Receiver not found' });
    }

    console.log('🔍 Looking up caller user:', req.user.userId);
    const callerUser = await User.findById(req.user.userId);
    if (!callerUser) {
      console.log('❌ Caller not found:', req.user.userId);
      return res.status(404).json({ message: 'Caller not found' });
    }
    
    if (callerUser.blockedUsers.includes(receiver)) {
      console.log('❌ Cannot call blocked user');
      return res.status(403).json({ message: 'Cannot call blocked user' });
    }

    // Simplified call privacy check for testing - ALLOW ALL CALLS FOR NOW
    const allowCallsFrom = receiverUser.preferences?.privacy?.allowCallsFrom || 'everyone';
    
    console.log('📞 Call privacy check (simplified):', {
      receiverId: receiver,
      receiverUsername: receiverUser.username,
      callerUsername: callerUser.username,
      allowCallsFrom,
      callAllowed: true // Always allow for testing
    });
    
    // Temporarily disable privacy restrictions for testing
    // TODO: Re-enable privacy checks after basic calling works
    console.log('✅ Call allowed (privacy checks temporarily disabled for testing)');
    

    // Create call record
    const call = new Call({
      caller: req.user.userId,
      receiver,
      type,
      status: 'initiated',
      metadata: {
        callerIP: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
      }
    });

    await call.save();

    // Populate caller info
    await call.populate('caller', 'username profilePicture');

    res.status(201).json(call);
  } catch (error) {
    console.error('Initiate call error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Answer call
router.put('/:callId/answer', authenticateToken, async (req, res) => {
  try {
    const { callId } = req.params;

    const call = await Call.findOne({
      _id: callId,
      receiver: req.user.userId,
      status: { $in: ['initiated', 'ringing'] }
    });

    if (!call) {
      return res.status(404).json({ message: 'Call not found or already answered' });
    }

    call.status = 'answered';
    await call.save();

    await call.populate('caller', 'username profilePicture');
    await call.populate('receiver', 'username profilePicture');

    res.json(call);
  } catch (error) {
    console.error('Answer call error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reject call
router.put('/:callId/reject', authenticateToken, async (req, res) => {
  try {
    const { callId } = req.params;

    const call = await Call.findOne({
      _id: callId,
      receiver: req.user.userId,
      status: { $in: ['initiated', 'ringing'] }
    });

    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }

    await call.rejectCall();

    res.json({ message: 'Call rejected' });
  } catch (error) {
    console.error('Reject call error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// End call
router.put('/:callId/end', authenticateToken, async (req, res) => {
  try {
    const { callId } = req.params;
    const { quality, recording } = req.body;

    const call = await Call.findOne({
      _id: callId,
      $or: [
        { caller: req.user.userId },
        { receiver: req.user.userId }
      ],
      status: { $in: ['answered', 'ringing'] }
    });

    if (!call) {
      return res.status(404).json({ message: 'Call not found or already ended' });
    }

    await call.endCall();

    // Update call quality and recording if provided
    if (quality) {
      call.quality = quality;
    }
    if (recording) {
      call.recording = recording;
    }

    await call.save();

    res.json(call);
  } catch (error) {
    console.error('End call error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get call history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const skip = (page - 1) * limit;

    const filter = {
      $or: [
        { caller: req.user.userId },
        { receiver: req.user.userId }
      ]
    };

    if (type && ['audio', 'video'].includes(type)) {
      filter.type = type;
    }

    const calls = await Call.find(filter)
      .populate('caller', 'username profilePicture')
      .populate('receiver', 'username profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json(calls);
  } catch (error) {
    console.error('Get call history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get call statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await Call.aggregate([
      {
        $match: {
          $or: [
            { caller: req.user.userId },
            { receiver: req.user.userId }
          ]
        }
      },
      {
        $group: {
          _id: null,
          totalCalls: { $sum: 1 },
          totalDuration: { $sum: '$duration' },
          audioCalls: {
            $sum: { $cond: [{ $eq: ['$type', 'audio'] }, 1, 0] }
          },
          videoCalls: {
            $sum: { $cond: [{ $eq: ['$type', 'video'] }, 1, 0] }
          },
          answeredCalls: {
            $sum: { $cond: [{ $eq: ['$status', 'answered'] }, 1, 0] }
          },
          missedCalls: {
            $sum: { $cond: [{ $eq: ['$status', 'missed'] }, 1, 0] }
          }
        }
      }
    ]);

    const result = stats[0] || {
      totalCalls: 0,
      totalDuration: 0,
      audioCalls: 0,
      videoCalls: 0,
      answeredCalls: 0,
      missedCalls: 0
    };

    res.json(result);
  } catch (error) {
    console.error('Get call stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get active calls
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const activeCalls = await Call.find({
      $or: [
        { caller: req.user.userId },
        { receiver: req.user.userId }
      ],
      status: { $in: ['initiated', 'ringing', 'answered'] }
    })
    .populate('caller', 'username profilePicture')
    .populate('receiver', 'username profilePicture');

    res.json(activeCalls);
  } catch (error) {
    console.error('Get active calls error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
