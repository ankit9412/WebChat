const express = require('express');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment-timezone');

const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const config = require('../config');
const { sendVerificationEmail, sendVerificationCode, generateVerificationCode, generateVerificationToken } = require('../utils/verification');
const passport = require('../config/passport');
const { createMockGoogleUser, createMockFacebookUser, createMockGitHubUser } = require('../config/mockAuth');

const router = express.Router();

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});


// Send security alert email
const sendSecurityAlert = async (email, alertType, details = {}) => {
  try {
    // Create transporter for security alerts
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.FROM_EMAIL,
        pass: config.FROM_PASS
      }
    });
    
    let subject, message;
    
    switch (alertType) {
      case 'failed_login':
        subject = 'Security Alert: Multiple Failed Login Attempts';
        message = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc3545;">⚠️ Security Alert</h2>
            <p>We detected multiple failed login attempts on your account.</p>
            <p><strong>Details:</strong></p>
            <ul>
              <li>Time: ${moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss IST')}</li>
              <li>IP Address: ${details.ipAddress || 'Unknown'}</li>
              <li>Failed Attempts: ${details.attempts || 5}</li>
            </ul>
            <p>If this was you, please try logging in again. If not, please secure your account immediately.</p>
            <p style="color: #666; font-size: 14px;">
              For security reasons, your account has been temporarily locked for 2 hours.
            </p>
          </div>
        `;
        break;
      default:
        subject = 'Security Alert - Web Chat by Ankit';
        message = `<p>Security alert for your account.</p>`;
    }

    const mailOptions = {
      from: config.FROM_EMAIL,
      to: email,
      subject: subject,
      html: message
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`Security alert sent to ${email}:`, result.messageId);
    return result;
  } catch (error) {
    console.error('Error sending security alert:', error);
    throw error;
  }
};

// Register new user
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    console.log('Registration attempt:', { username, email });

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({ 
        message: existingUser.email === email ? 'Email already registered' : 'Username already taken' 
      });
    }

    // Create new user with email verification required
    const verificationToken = generateVerificationToken();
    const verificationCode = generateVerificationCode();
    
    const user = new User({
      username,
      email,
      password,
      isEmailVerified: false, // Require email verification
      emailVerificationToken: verificationToken,
      emailVerificationCode: verificationCode,
      emailVerificationCodeExpires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      status: 'offline'
    });
    
    await user.save();
    console.log('User created, sending verification email:', user._id);

    // Send verification email
    try {
      const emailResult = await sendVerificationEmail(email, verificationCode, verificationToken, username);
      
      if (emailResult.success) {
        console.log('✅ Verification email sent successfully');
        
        // Log registration activity (non-blocking)
        ActivityLog.logActivity({
          user: user._id,
          action: 'register',
          description: `User ${username} registered with email ${email}`,
          metadata: {
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            success: true,
            emailSent: true
          },
          severity: 'low',
          category: 'authentication'
        }).catch(logError => {
          console.error('Failed to log registration activity:', logError);
        });
        
        res.status(201).json({
          message: 'Registration successful! Please check your email to verify your account.',
          userId: user._id,
          verificationRequired: true,
          emailSent: true
        });
      } else {
        console.error('❌ Failed to send verification email:', emailResult.error);
        
        // Still allow registration but inform user about email issue
        res.status(201).json({
          message: 'Registration successful! However, there was an issue sending the verification email. Please try resending it.',
          userId: user._id,
          verificationRequired: true,
          emailSent: false,
          emailError: 'Failed to send verification email'
        });
      }
    } catch (emailError) {
      console.error('❌ Email sending error:', emailError);
      
      res.status(201).json({
        message: 'Registration successful! However, there was an issue sending the verification email. Please try resending it.',
        userId: user._id,
        verificationRequired: true,
        emailSent: false,
        emailError: 'Email service temporarily unavailable'
      });
    }

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      message: 'Server error during registration',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Verify email with token (link method)
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ message: 'Verification token is required' });
    }

    const user = await User.findOne({ emailVerificationToken: token });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification token' });
    }

    if (user.isEmailVerified) {
      return res.json({ message: 'Email is already verified' });
    }

    // Clear all verification data and verify user
    user.clearVerificationData();
    await user.save();

    // Log successful verification
    ActivityLog.logActivity({
      user: user._id,
      action: 'email_verified',
      description: `Email verified successfully via link for ${user.username}`,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        method: 'link'
      },
      severity: 'low',
      category: 'authentication'
    }).catch(logError => {
      console.error('Failed to log email verification activity:', logError);
    });

    res.json({ 
      message: 'Email verified successfully! You can now log in.',
      verified: true
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ message: 'Server error during email verification' });
  }
});

// Verify email with code
router.post('/verify-code', authLimiter, async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ message: 'Email and verification code are required' });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isEmailVerified) {
      return res.json({ message: 'Email is already verified' });
    }

    // Verify the code
    const verificationResult = user.verifyCode(code);
    
    if (!verificationResult.success) {
      // Save the updated attempt count
      await user.save();
      
      return res.status(400).json({ 
        message: verificationResult.message,
        attemptsRemaining: Math.max(0, 5 - user.emailVerificationAttempts)
      });
    }

    // Code is valid, verify the user
    user.clearVerificationData();
    await user.save();

    console.log(`Email verified successfully with code for user: ${user.username}`);

    // Log successful verification
    ActivityLog.logActivity({
      user: user._id,
      action: 'email_verified',
      description: `Email verified successfully via code for ${user.username}`,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        method: 'code'
      },
      severity: 'low',
      category: 'authentication'
    }).catch(logError => {
      console.error('Failed to log email verification activity:', logError);
    });

    res.json({ 
      message: 'Email verified successfully! You can now log in.',
      verified: true
    });

  } catch (error) {
    console.error('Code verification error:', error);
    res.status(500).json({ message: 'Server error during code verification' });
  }
});

// Login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check if account is locked
    if (user.isLocked()) {
      return res.status(423).json({ 
        message: 'Account temporarily locked due to multiple failed login attempts. Please try again later.' 
      });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return res.status(401).json({ 
        message: 'Please verify your email address before logging in' 
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      // Increment failed login attempts
      await user.incLoginAttempts();
      
      // Add security alert
      await user.addSecurityAlert('failed_login', ipAddress, userAgent);

      // Log failed login activity
      try {
        await ActivityLog.logActivity({
          user: user._id,
          action: 'login',
          description: `Failed login attempt for ${user.username}`,
          metadata: {
            ipAddress,
            userAgent,
            success: false,
            errorMessage: 'Invalid password'
          },
          severity: 'medium',
          category: 'authentication'
        });
      } catch (logError) {
        console.error('Failed to log failed login activity:', logError);
      }

      // Check if we should send security alert
      const updatedUser = await User.findById(user._id);
      if (updatedUser.failedLoginAttempts >= config.FAILED_LOGIN_LIMIT) {
        await sendSecurityAlert(email, 'failed_login', {
          ipAddress,
          attempts: updatedUser.failedLoginAttempts
        });
      }

      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Reset failed login attempts on successful login
    await user.resetLoginAttempts();

    // Update user status
    user.status = 'online';
    user.lastSeen = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN }
    );

    // Log successful login activity
    try {
      await ActivityLog.logActivity({
        user: user._id,
        action: 'login',
        description: `Successful login for ${user.username}`,
        metadata: {
          ipAddress,
          userAgent,
          success: true
        },
        severity: 'low',
        category: 'authentication'
      });
    } catch (logError) {
      console.error('Failed to log successful login activity:', logError);
    }

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        status: user.status,
        isEmailVerified: user.isEmailVerified,
        role: user.role // Add role to login response
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Resend verification (code and link)
router.post('/resend-verification', authLimiter, async (req, res) => {
  try {
    const { email, method = 'both' } = req.body; // method can be 'code', 'link', or 'both'

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ message: 'Email already verified' });
    }

    let emailResult;

    try {
      if (method === 'code') {
        // Send only verification code
        const verificationCode = user.generateVerificationCode();
        await user.save();
        
        emailResult = await sendVerificationCode(email, verificationCode, user.username);
        
        if (emailResult.success) {
          res.json({ 
            message: 'New verification code sent to your email',
            codeExpires: user.emailVerificationCodeExpires,
            method: 'code'
          });
        } else {
          res.status(500).json({ message: 'Failed to send verification code' });
        }
        
      } else {
        // Send both code and link (default) or just link
        const verificationToken = generateVerificationToken();
        const verificationCode = user.generateVerificationCode();
        
        user.emailVerificationToken = verificationToken;
        await user.save();
        
        emailResult = await sendVerificationEmail(email, verificationCode, verificationToken, user.username);
        
        if (emailResult.success) {
          res.json({ 
            message: 'Verification email sent with both code and link options',
            codeExpires: user.emailVerificationCodeExpires,
            method: 'both'
          });
        } else {
          res.status(500).json({ message: 'Failed to send verification email' });
        }
      }
      
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      res.status(500).json({ 
        message: 'Failed to send verification email',
        error: emailError.message 
      });
    }

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Forgot password
router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate reset token
    const resetToken = uuidv4();
    user.emailVerificationToken = resetToken; // Reusing this field for reset token
    await user.save();

    // Create transporter for password reset
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.FROM_EMAIL,
        pass: config.FROM_PASS
      }
    });
    
    // Send reset email
    const resetUrl = `${config.CLIENT_URL}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: config.FROM_EMAIL,
      to: email,
      subject: 'Reset Your Password - Web Chat by Ankit',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>You requested to reset your password. Click the button below to reset it.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${resetUrl}</p>
          <p style="color: #666; font-size: 14px;">
            This link will expire in 1 hour. If you didn't request this, please ignore this email.
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    res.json({ message: 'Password reset email sent successfully' });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reset password
router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const user = await User.findOne({ emailVerificationToken: token });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    user.password = newPassword;
    user.emailVerificationToken = null;
    await user.save();

    res.json({ message: 'Password reset successfully' });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Test email endpoint (for debugging)
router.post('/test-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const testToken = generateVerificationToken();
    const testCode = generateVerificationCode();
    const result = await sendVerificationEmail(email, testCode, testToken, 'Test User');
    
    if (result.success) {
      res.json({ 
        message: 'Test email sent successfully',
        email: email,
        token: testToken,
        code: testCode
      });
    } else {
      res.status(500).json({ 
        message: 'Failed to send test email',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ 
      message: 'Failed to send test email',
      error: error.message
    });
  }
});

// OAuth Routes

// Google OAuth
router.get('/google', (req, res, next) => {
  // Check if using demo/mock credentials
  if (process.env.GOOGLE_CLIENT_ID === 'demo-google-client-id-for-development') {
    console.log('🟡 Using mock Google OAuth for development');
    return createMockGoogleUser(req, res);
  }
  
  // Check if not configured
  if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID === 'your-google-client-id') {
    return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=google_not_configured`);
  }
  
  // Use real OAuth
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login?error=google_auth_failed' }),
  async (req, res) => {
    try {
      const token = jwt.sign(
        { userId: req.user._id },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );
      
      // Redirect to frontend with token
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/login?token=${token}&provider=google`);
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      res.redirect('/login?error=oauth_error');
    }
  }
);

// Facebook OAuth  
router.get('/facebook', (req, res, next) => {
  // Check if using demo/mock credentials
  if (process.env.FACEBOOK_APP_ID === 'demo-facebook-app-id-for-development') {
    console.log('🧪 Using mock Facebook OAuth for development');
    return createMockFacebookUser(req, res);
  }
  
  // Check if Facebook strategy is registered and configured with real credentials
  if (process.env.FACEBOOK_APP_ID && 
      process.env.FACEBOOK_APP_ID !== 'your-facebook-app-id' &&
      passport._strategies && passport._strategies.facebook) {
    console.log('🔴 Using real Facebook OAuth');
    return passport.authenticate('facebook', { scope: ['email'] })(req, res, next);
  }
  
  // Fallback to mock for development
  console.log('🧪 Using mock Facebook OAuth for development');
  return createMockFacebookUser(req, res);
});

router.get('/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/login?error=facebook_auth_failed' }),
  async (req, res) => {
    try {
      const token = jwt.sign(
        { userId: req.user._id },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );
      
      // Redirect to frontend with token
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/login?token=${token}&provider=facebook`);
    } catch (error) {
      console.error('Facebook OAuth callback error:', error);
      res.redirect('/login?error=oauth_error');
    }
  }
);

// GitHub OAuth
router.get('/github', (req, res, next) => {
  // Check if using demo/mock credentials
  if (process.env.GITHUB_CLIENT_ID === 'demo-github-client-id-for-development') {
    console.log('🧪 Using mock GitHub OAuth for development');
    return createMockGitHubUser(req, res);
  }
  
  // Check if GitHub strategy is registered and configured with real credentials
  if (process.env.GITHUB_CLIENT_ID && 
      process.env.GITHUB_CLIENT_ID !== 'your-github-client-id' &&
      passport._strategies && passport._strategies.github) {
    console.log('🟣 Using real GitHub OAuth');
    return passport.authenticate('github', { scope: ['user:email'] })(req, res, next);
  }
  
  // Fallback to mock for development
  console.log('🧪 Using mock GitHub OAuth for development');
  return createMockGitHubUser(req, res);
});

router.get('/github/callback',
  passport.authenticate('github', { failureRedirect: '/login?error=github_auth_failed' }),
  async (req, res) => {
    try {
      const token = jwt.sign(
        { userId: req.user._id },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );
      
      // Redirect to frontend with token
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/login?token=${token}&provider=github`);
    } catch (error) {
      console.error('GitHub OAuth callback error:', error);
      res.redirect('/login?error=oauth_error');
    }
  }
);

// OAuth logout
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ message: 'Logout error' });
    }
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: 'Session destroy error' });
      }
      res.json({ message: 'Logged out successfully' });
    });
  });
});

module.exports = router;
