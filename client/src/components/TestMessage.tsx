import React from 'react';
import { Button, Box } from '@mui/material';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

interface TestMessageProps {
  targetUserId: string;
  targetUsername: string;
}

const TestMessage: React.FC<TestMessageProps> = ({ targetUserId, targetUsername }) => {
  const { socket } = useSocket();
  const { user } = useAuth();

  const sendTestMessage = () => {
    if (!socket || !user) {
      console.log('❌ No socket or user for test message');
      return;
    }

    const testMessage = {
      _id: 'test-' + Date.now(),
      sender: {
        _id: user.id,
        username: user.username,
        profilePicture: user.profilePicture
      },
      receiver: targetUserId,
      content: `Test message from ${user.username} at ${new Date().toLocaleTimeString()}`,
      type: 'text',
      createdAt: new Date().toISOString(),
      status: 'sent',
      isEdited: false,
      reactions: []
    };

    console.log('🧪 Sending test message:', testMessage);

    // Emit via socket
    socket.emit('send-message', {
      senderId: user.id,
      receiverId: targetUserId,
      message: testMessage
    });

    console.log('✅ Test message sent to:', targetUsername);
  };

  return (
    <Box sx={{ p: 1 }}>
      <Button
        variant="contained"
        size="small"
        onClick={sendTestMessage}
        className="btn-3d"
        sx={{
          background: 'linear-gradient(135deg, #ff6b6b, #ee5a24)',
          color: 'white',
          fontSize: '12px',
          '&:hover': {
            transform: 'translateY(-2px) scale(1.05)',
          }
        }}
      >
        🧪 Test Message to {targetUsername}
      </Button>
    </Box>
  );
};

export default TestMessage;