const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Local Strategy
passport.use(new LocalStrategy(
  {
    usernameField: 'email',
    passwordField: 'password'
  },
  async (email, password, done) => {
    try {
      const user = await User.findOne({ email });
      if (!user) {
        return done(null, false, { message: 'Invalid email or password' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return done(null, false, { message: 'Invalid email or password' });
      }

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }
));

// Google Strategy - only if credentials are provided (skip for demo since we use mock)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your-google-client-id' && process.env.GOOGLE_CLIENT_ID !== 'demo-google-client-id-for-development') {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/auth/google/callback"
  }, async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user already exists
    let user = await User.findOne({ 
      $or: [
        { googleId: profile.id },
        { email: profile.emails[0].value }
      ]
    });

    if (user) {
      // Update Google ID if not set
      if (!user.googleId) {
        user.googleId = profile.id;
        await user.save();
      }
      return done(null, user);
    }

    // Create new user
    user = new User({
      googleId: profile.id,
      username: profile.displayName || profile.emails[0].value.split('@')[0],
      email: profile.emails[0].value,
      avatar: profile.photos[0].value,
      isVerified: true, // Google accounts are pre-verified
      provider: 'google'
    });

    await user.save();
    done(null, user);
  } catch (error) {
    done(error, null);
  }
  }));
} else {
  if (process.env.GOOGLE_CLIENT_ID === 'demo-google-client-id-for-development') {
    console.log('✅ Google OAuth: Using mock authentication for development');
  } else {
    console.log('⚠️  Google OAuth disabled: Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env');
  }
}

// Facebook Strategy - only if credentials are provided (skip demo credentials)
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_ID !== 'your-facebook-app-id' && process.env.FACEBOOK_APP_ID !== 'demo-facebook-app-id-for-development') {
  passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "/api/auth/facebook/callback",
    profileFields: ['id', 'emails', 'name', 'picture.type(large)']
  }, async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user already exists
    let user = await User.findOne({ 
      $or: [
        { facebookId: profile.id },
        { email: profile.emails && profile.emails[0] ? profile.emails[0].value : null }
      ]
    });

    if (user) {
      // Update Facebook ID if not set
      if (!user.facebookId) {
        user.facebookId = profile.id;
        await user.save();
      }
      return done(null, user);
    }

    // Create new user
    user = new User({
      facebookId: profile.id,
      username: `${profile.name.givenName} ${profile.name.familyName}`,
      email: profile.emails && profile.emails[0] ? profile.emails[0].value : `${profile.id}@facebook.com`,
      avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
      isVerified: true, // Facebook accounts are pre-verified
      provider: 'facebook'
    });

    await user.save();
    done(null, user);
  } catch (error) {
    done(error, null);
  }
  }));
} else {
  if (process.env.FACEBOOK_APP_ID === 'demo-facebook-app-id-for-development') {
    console.log('✅ Facebook OAuth: Using mock authentication for development');
  } else {
    console.log('✅ Facebook OAuth: Using mock authentication for development');
  }
}

// GitHub Strategy - only if credentials are provided (skip demo credentials)
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_ID !== 'your-github-client-id' && process.env.GITHUB_CLIENT_ID !== 'demo-github-client-id-for-development') {
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: "/api/auth/github/callback"
  }, async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user already exists
    let user = await User.findOne({ 
      $or: [
        { githubId: profile.id },
        { email: profile.emails && profile.emails[0] ? profile.emails[0].value : null }
      ]
    });

    if (user) {
      // Update GitHub ID if not set
      if (!user.githubId) {
        user.githubId = profile.id;
        await user.save();
      }
      return done(null, user);
    }

    // Create new user
    user = new User({
      githubId: profile.id,
      username: profile.username || profile.displayName,
      email: profile.emails && profile.emails[0] ? profile.emails[0].value : `${profile.username}@github.local`,
      avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
      isVerified: true, // GitHub accounts are pre-verified
      provider: 'github'
    });

    await user.save();
    done(null, user);
  } catch (error) {
    done(error, null);
  }
  }));
} else {
  if (process.env.GITHUB_CLIENT_ID === 'demo-github-client-id-for-development') {
    console.log('✅ GitHub OAuth: Using mock authentication for development');
  } else {
    console.log('✅ GitHub OAuth: Using mock authentication for development');
  }
}

module.exports = passport;