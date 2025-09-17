import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  emit: (event: string, data?: any) => void;
  on: (event: string, callback: (...args: any[]) => void) => void;
  off: (event: string, callback?: (...args: any[]) => void) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      console.log('Initializing socket connection for user:', user.id);
      
      const newSocket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:5001', {
        auth: {
          token: localStorage.getItem('token'),
          userId: user.id
        },
        transports: ['websocket', 'polling'],
        upgrade: true,
        rememberUpgrade: true
      });

      newSocket.on('connect', () => {
        console.log('✅ Connected to server with socket ID:', newSocket.id);
        console.log('👤 Current user data:', { id: user.id, username: user.username });
        setIsConnected(true);
        
        // Join user's personal room for receiving messages
        console.log('📡 Attempting to join user room with ID:', user.id);
        newSocket.emit('join-user', user.id);
        console.log('📡 Join-user event emitted for user:', user.id);
      });
      
      // Listen for room join confirmation
      newSocket.on('room-joined', (data) => {
        console.log('🎉 Successfully joined room:', data);
      });
      
      newSocket.on('join-error', (error) => {
        console.error('❌ Failed to join room:', error);
      });

      newSocket.on('disconnect', (reason) => {
        console.log('❌ Disconnected from server:', reason);
        setIsConnected(false);
        
        // Auto-reconnect after disconnect
        if (reason === 'io server disconnect') {
          // Server disconnected, need to reconnect manually
          setTimeout(() => {
            console.log('🔄 Attempting to reconnect...');
            newSocket.connect();
          }, 1000);
        }
      });

      newSocket.on('connect_error', (error) => {
        console.error('🚫 Connection error:', error);
        setIsConnected(false);
      });
      
      newSocket.on('reconnect', (attemptNumber) => {
        console.log('🔄 Reconnected after', attemptNumber, 'attempts');
        setIsConnected(true);
        newSocket.emit('join-user', user.id);
      });
      
      // Debug: Log all incoming events
      newSocket.onAny((eventName, ...args) => {
        console.log('📨 Socket event received:', eventName, args);
      });

      setSocket(newSocket);

      return () => {
        console.log('🧹 Cleaning up socket connection');
        newSocket.close();
      };
    } else {
      if (socket) {
        console.log('👤 User logged out, closing socket');
        socket.close();
        setSocket(null);
        setIsConnected(false);
      }
    }
  }, [user]);

  const emit = (event: string, data?: any) => {
    if (socket && isConnected) {
      socket.emit(event, data);
    }
  };

  const on = (event: string, callback: (...args: any[]) => void) => {
    if (socket) {
      socket.on(event, callback);
    }
  };

  const off = (event: string, callback?: (...args: any[]) => void) => {
    if (socket) {
      if (callback) {
        socket.off(event, callback);
      } else {
        socket.removeAllListeners(event);
      }
    }
  };

  const value: SocketContextType = {
    socket,
    isConnected,
    emit,
    on,
    off,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = (): SocketContextType => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
