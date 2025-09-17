module.exports = {
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/webchat',
  JWT_SECRET: process.env.JWT_SECRET || 'your_jwt_secret_key_here',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
  PORT: process.env.PORT || 5000,
  
  // Email configuration
  FROM_EMAIL: 'sinugahlot0@gmail.com',
  FROM_PASS: 'nccv rvor mqrq algr',
  SMTP_SERVER: 'smtp.gmail.com',
  SMTP_PORT: 587,
  
  // Security settings
  FAILED_LOGIN_LIMIT: 5,
  JWT_EXPIRES_IN: '7d',
  
  // File upload settings
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_FILE_TYPES: [
    'image/jpeg', 'image/png', 'image/gif', 
    'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp3',
    'audio/webm;codecs=opus', 'audio/mp4', 'audio/aac', 'audio/x-m4a',
    'audio/ogg;codecs=opus', 'audio/flac',
    'video/mp4', 'video/webm'
  ]
};
