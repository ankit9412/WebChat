const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

const seedUsers = [
  {
    username: 'ankit',
    email: 'ankit@example.com',
    password: 'password123',
    isEmailVerified: true,
    profilePicture: null,
    status: 'online',
    lastSeen: new Date()
  },
  {
    username: 'alice',
    email: 'alice@example.com',
    password: 'password123',
    isEmailVerified: true,
    profilePicture: null,
    status: 'online',
    lastSeen: new Date()
  },
  {
    username: 'bob',
    email: 'bob@example.com',
    password: 'password123',
    isEmailVerified: true,
    profilePicture: null,
    status: 'away',
    lastSeen: new Date()
  },
  {
    username: 'charlie',
    email: 'charlie@example.com',
    password: 'password123',
    isEmailVerified: true,
    profilePicture: null,
    status: 'busy',
    lastSeen: new Date()
  }
];

async function seedDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/webchat', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to MongoDB!');
    
    // Clear existing data
    console.log('Clearing existing users...');
    await User.deleteMany({});
    
    console.log('Creating demo users...');
    
    for (const userData of seedUsers) {
      // Hash password
      const salt = await bcrypt.genSalt(10);
      userData.password = await bcrypt.hash(userData.password, salt);
      
      // Create user
      const user = new User(userData);
      await user.save();
      console.log(`✅ Created user: ${userData.username} (${userData.email})`);
    }
    
    console.log('\n🎉 Seed data created successfully!');
    console.log('\nDemo accounts:');
    seedUsers.forEach(user => {
      console.log(`- ${user.email} / password123`);
    });
    
    console.log('\nYou can now login with any of these accounts.');
    
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    mongoose.connection.close();
  }
}

seedDatabase();