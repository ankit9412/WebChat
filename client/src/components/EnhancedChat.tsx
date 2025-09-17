import React, { useState, useEffect } from 'react';
import { Box, Container } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import ContactList, { CallFab } from './ContactList';
import IncomingCallNotification from './IncomingCallNotification';
import ReliableCallInterface from './ReliableCallInterface';

interface User {
  _id: string;
  username: string;
  email: string;
  profilePicture?: string;
  isOnline?: boolean;
  lastSeen?: Date;
}

interface IncomingCall {
  from: string;
  caller: User;
  type: 'audio' | 'video';
  roomId: string;
}

const EnhancedChat: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { socket, emit } = useSocket();
  
  // States for call management
  const [showContactList, setShowContactList] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [activeCall, setActiveCall] = useState<{
    user: User;
    type: 'audio' | 'video';
    isIncoming: boolean;
  } | null>(null);
  
  // Mock users list - replace with actual API call
  const [users, setUsers] = useState<User[]>([
    {
      _id: '1',
      username: 'John Doe',
      email: 'john@example.com',
      isOnline: true,
      lastSeen: new Date()
    },
    {
      _id: '2',
      username: 'Jane Smith',
      email: 'jane@example.com',
      isOnline: false,
      lastSeen: new Date(Date.now() - 3600000) // 1 hour ago
    },
    {
      _id: '3',
      username: 'Mike Johnson',
      email: 'mike@example.com',
      isOnline: true,
      lastSeen: new Date()
    }
  ]);

  useEffect(() => {
    if (!socket) return;

    // Listen for incoming calls
    const handleIncomingCall = (data: any) => {
      console.log('📞 Incoming call received:', data);
      
      // Find caller information
      const caller = users.find(user => user._id === data.from) || {
        _id: data.from,
        username: data.callerName || 'Unknown Caller',
        email: data.callerEmail || 'unknown@example.com'
      };
      
      setIncomingCall({
        from: data.from,
        caller,
        type: data.type || 'video',
        roomId: data.roomId
      });
    };

    // Listen for call ended
    const handleCallEnded = () => {
      console.log('📞 Call ended by remote peer');
      setIncomingCall(null);
      setActiveCall(null);
    };

    // Listen for call rejected
    const handleCallRejected = () => {
      console.log('📞 Call rejected by remote peer');
      setActiveCall(null);
    };

    socket.on('incoming-call', handleIncomingCall);
    socket.on('call-ended', handleCallEnded);
    socket.on('call-rejected', handleCallRejected);

    return () => {
      socket.off('incoming-call', handleIncomingCall);
      socket.off('call-ended', handleCallEnded);
      socket.off('call-rejected', handleCallRejected);
    };
  }, [socket, users]);

  const handleStartCall = (user: User, type: 'audio' | 'video') => {
    console.log(`🚀 Starting ${type} call to:`, user.username);
    
    // Emit call initiation to server
    emit('initiate-call', {
      to: user._id,
      type: type,
      callerName: currentUser?.username,
      callerEmail: currentUser?.email,
      roomId: `call_${currentUser?.id}_${user._id}_${Date.now()}`
    });
    
    setActiveCall({
      user,
      type,
      isIncoming: false
    });
  };

  const handleAcceptCall = () => {
    if (!incomingCall) return;
    
    console.log('✅ Accepting incoming call');
    
    // Emit call acceptance to server
    emit('accept-call', {
      from: incomingCall.from,
      roomId: incomingCall.roomId
    });
    
    setActiveCall({
      user: incomingCall.caller,
      type: incomingCall.type,
      isIncoming: true
    });
    
    setIncomingCall(null);
  };

  const handleRejectCall = () => {
    if (!incomingCall) return;
    
    console.log('❌ Rejecting incoming call');
    
    // Emit call rejection to server
    emit('reject-call', {
      from: incomingCall.from,
      roomId: incomingCall.roomId
    });
    
    setIncomingCall(null);
  };

  const handleEndCall = () => {
    if (!activeCall) return;
    
    console.log('📞 Ending active call');
    
    // Emit call end to server
    emit('end-call', {
      to: activeCall.user._id
    });
    
    setActiveCall(null);
  };

  const handleCallAccept = () => {
    // This is called when the current user accepts an outgoing call that was answered
    console.log('✅ Call accepted by remote user');
  };

  const handleCallReject = () => {
    // This is called when an outgoing call is rejected
    console.log('❌ Call rejected by remote user');
    setActiveCall(null);
  };

  return (
    <Container maxWidth="lg" sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Main Chat Interface */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2 }}>
        <Box 
          sx={{ 
            flex: 1, 
            bgcolor: 'background.paper', 
            borderRadius: 2,
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {/* Replace this with your actual chat interface */}
          <Box sx={{ textAlign: 'center' }}>
            <h2>WhatsApp-like Video Calling Demo</h2>
            <p>Click the video call button to start a call with any contact.</p>
            <p>Current users online: {users.filter(u => u.isOnline).length}</p>
          </Box>
        </Box>
      </Box>

      {/* Floating Action Button for Video Calls */}
      <CallFab 
        onClick={() => setShowContactList(true)} 
        type="video" 
      />

      {/* Contact Selection Dialog */}
      <ContactList
        open={showContactList}
        onClose={() => setShowContactList(false)}
        onStartCall={handleStartCall}
        users={users}
      />

      {/* Incoming Call Notification */}
      <IncomingCallNotification
        open={!!incomingCall}
        caller={incomingCall?.caller || null}
        callType={incomingCall?.type || 'video'}
        onAccept={handleAcceptCall}
        onReject={handleRejectCall}
        duration={30} // Auto-reject after 30 seconds
      />

      {/* Active Call Interface */}
      {activeCall && (
        <ReliableCallInterface
          open={!!activeCall}
          type={activeCall.type}
          user={activeCall.user}
          isIncoming={activeCall.isIncoming}
          onEnd={handleEndCall}
          onAccept={handleCallAccept}
          onReject={handleCallReject}
        />
      )}
    </Container>
  );
};

export default EnhancedChat;