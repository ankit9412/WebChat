// Mock OAuth for development testing
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const createMockGoogleUser = async (req, res) => {
  try {
    console.log('🧪 Mock Google OAuth login triggered');
    
    // Create or find a test user
    const mockGoogleProfile = {
      id: 'mock-google-id-12345',
      displayName: 'Test Google User',
      emails: [{ value: 'testuser@gmail.com' }],
      photos: [{ value: 'https://lh3.googleusercontent.com/a/default-user=s96-c' }]
    };

    let user = await User.findOne({ 
      $or: [
        { googleId: mockGoogleProfile.id },
        { email: mockGoogleProfile.emails[0].value }
      ]
    });

    if (user) {
      // Update existing user
      if (!user.googleId) {
        user.googleId = mockGoogleProfile.id;
        user.provider = 'google';
        await user.save();
      }
    } else {
      // Create new user
      user = new User({
        googleId: mockGoogleProfile.id,
        username: mockGoogleProfile.displayName.replace(/\s+/g, '_').toLowerCase(),
        email: mockGoogleProfile.emails[0].value,
        avatar: mockGoogleProfile.photos[0].value,
        isVerified: true,
        isEmailVerified: true,
        provider: 'google'
      });
      await user.save();
      console.log('✅ Mock Google user created:', user.email);
    }

    // Create JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Redirect to frontend with token
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/login?token=${token}&provider=google`);
    
  } catch (error) {
    console.error('❌ Mock Google OAuth error:', error);
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=mock_oauth_error`);
  }
};

const createMockFacebookUser = async (req, res) => {
  try {
    console.log('🧪 Mock Facebook OAuth login triggered');
    
    const mockFacebookProfile = {
      id: 'mock-facebook-id-67890',
      displayName: 'Test Facebook User',
      emails: [{ value: 'testuser@facebook.com' }],
      photos: [{ value: 'https://graph.facebook.com/v2.6/mock-id/picture?type=large' }]
    };

    let user = await User.findOne({ 
      $or: [
        { facebookId: mockFacebookProfile.id },
        { email: mockFacebookProfile.emails[0].value }
      ]
    });

    if (!user) {
      user = new User({
        facebookId: mockFacebookProfile.id,
        username: mockFacebookProfile.displayName.replace(/\s+/g, '_').toLowerCase(),
        email: mockFacebookProfile.emails[0].value,
        avatar: mockFacebookProfile.photos[0].value,
        isVerified: true,
        isEmailVerified: true,
        provider: 'facebook'
      });
      await user.save();
      console.log('✅ Mock Facebook user created:', user.email);
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/login?token=${token}&provider=facebook`);
    
  } catch (error) {
    console.error('❌ Mock Facebook OAuth error:', error);
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=mock_oauth_error`);
  }
};

const createMockGitHubUser = async (req, res) => {
  try {
    console.log('🧪 Mock GitHub OAuth login triggered');
    
    const mockGitHubProfile = {
      id: 'mock-github-id-54321',
      username: 'testgithubuser',
      displayName: 'Test GitHub User',
      emails: [{ value: 'testuser@github.com' }],
      photos: [{ value: 'https://avatars.githubusercontent.com/u/mock-id?v=4' }]
    };

    let user = await User.findOne({ 
      $or: [
        { githubId: mockGitHubProfile.id },
        { email: mockGitHubProfile.emails[0].value }
      ]
    });

    if (!user) {
      user = new User({
        githubId: mockGitHubProfile.id,
        username: mockGitHubProfile.username,
        email: mockGitHubProfile.emails[0].value,
        avatar: mockGitHubProfile.photos[0].value,
        isVerified: true,
        isEmailVerified: true,
        provider: 'github'
      });
      await user.save();
      console.log('✅ Mock GitHub user created:', user.email);
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/login?token=${token}&provider=github`);
    
  } catch (error) {
    console.error('❌ Mock GitHub OAuth error:', error);
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=mock_oauth_error`);
  }
};

module.exports = {
  createMockGoogleUser,
  createMockFacebookUser,
  createMockGitHubUser
};