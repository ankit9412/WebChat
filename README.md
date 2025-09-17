# Web Chat by Ankit

A modern, feature-rich web chat application with video calling, audio calling, voice notes, and advanced messaging features.

## Features

### 🔐 Authentication & Security
- User registration with email verification
- Secure login with JWT tokens
- Password reset functionality
- Security alerts for failed login attempts (5 attempts = account lockout + email alert)
- Account lockout after multiple failed attempts

### 💬 Messaging
- Real-time messaging with Socket.io
- Message timestamps in IST (Indian Standard Time)
- Message status (sent, delivered, read)
- Message editing and deletion
- Reply to messages
- Message reactions (emojis)
- Typing indicators

### 🎤 Voice & Video
- Voice note recording and playback
- Audio calling
- Video calling
- Call history and statistics
- WebRTC integration for high-quality calls

### 📁 File Sharing
- Image sharing with preview
- File uploads (documents, videos, audio)
- Drag & drop file upload
- File type validation and size limits

### 🎨 Modern UI
- Material-UI design system
- Responsive design for mobile and desktop
- Dark/Light theme support
- Real-time status indicators
- Online/offline status
- Last seen timestamps

### 👥 User Management
- User search and discovery
- Friend management
- User blocking
- Profile management
- Privacy settings

## Tech Stack

### Backend
- Node.js with Express
- MongoDB with Mongoose
- Socket.io for real-time communication
- JWT for authentication
- Nodemailer for email services
- Multer for file uploads
- bcryptjs for password hashing

### Frontend
- React with TypeScript
- Material-UI for components
- Socket.io-client for real-time features
- React Hook Form with Yup validation
- Axios for API calls
- React Webcam for video calls
- React Audio Voice Recorder for voice notes

## Installation

### Prerequisites
- Node.js (v14 or higher)
- MongoDB
- Gmail account for email services

### Quick Setup (Windows)

1. **Run the setup script:**
   ```bash
   setup.bat
   ```

2. **Start MongoDB service**

3. **Start the application:**
   ```bash
   npm run start-all
   ```

### Manual Setup

#### Backend Setup

1. Install dependencies:
```bash
npm install
```

2. The app is already configured with your email credentials in `config.js`

3. Start MongoDB service

4. (Optional) Seed demo data:
```bash
npm run seed
```

5. Run the server:
```bash
npm start
# or for development
npm run dev
```

#### Frontend Setup

1. Navigate to client directory:
```bash
cd client
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

### Demo Accounts (if you ran seed)
- **ankit@example.com** / password123
- **alice@example.com** / password123  
- **bob@example.com** / password123
- **charlie@example.com** / password123

## Usage

1. Open your browser and go to `http://localhost:3000`
2. Register a new account with username, email, and password
3. Check your email and verify your account
4. Login with your credentials
5. Start chatting with other users!

## Security Features

- **Email Verification**: New accounts require email verification
- **Password Security**: Passwords are hashed with bcrypt
- **Account Lockout**: 5 failed login attempts lock the account for 2 hours
- **Security Alerts**: Email notifications for suspicious activity
- **JWT Tokens**: Secure authentication tokens
- **Rate Limiting**: API rate limiting to prevent abuse

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/verify-email` - Email verification
- `POST /api/auth/forgot-password` - Password reset request
- `POST /api/auth/reset-password` - Password reset

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/search` - Search users
- `POST /api/users/friends/:userId` - Add friend
- `DELETE /api/users/friends/:userId` - Remove friend

### Messages
- `POST /api/messages/send` - Send message
- `POST /api/messages/send-file` - Send file
- `GET /api/messages/conversation/:userId` - Get conversation
- `PUT /api/messages/mark-read/:userId` - Mark messages as read
- `POST /api/messages/:messageId/reaction` - Add reaction

### Calls
- `POST /api/calls/initiate` - Initiate call
- `PUT /api/calls/:callId/answer` - Answer call
- `PUT /api/calls/:callId/reject` - Reject call
- `PUT /api/calls/:callId/end` - End call
- `GET /api/calls/history` - Get call history

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Author

**Ankit** - Web Chat Application

---

For support or questions, please contact the developer.
