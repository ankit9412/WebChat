import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authAPI, userAPI } from '../services/api';

interface User {
  id: string;
  username: string;
  email: string;
  profilePicture?: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  isEmailVerified: boolean;
  role: 'user' | 'admin' | 'moderator';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithToken: (token: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<any>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);


export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const response = await userAPI.getProfile();
          const userData = response.data as any;
          console.log('👤 Raw user data from API:', userData);
          
          // Transform MongoDB _id to id for frontend use
          const user: User = {
            id: userData._id || userData.id,
            username: userData.username,
            email: userData.email,
            profilePicture: userData.profilePicture,
            status: userData.status || 'offline',
            isEmailVerified: userData.isEmailVerified || false,
            role: userData.role || 'user'
          };
          
          console.log('✨ Transformed user data:', user);
          setUser(user);
        } catch (error) {
          console.error('Auth initialization error:', error);
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    try {
      const response = await authAPI.login(email, password);
      const { token, user: userData } = response.data as any;
      console.log('🔑 Login response user data:', userData);
      
      localStorage.setItem('token', token);
      
      // Transform user data
      const user: User = {
        id: userData._id || userData.id,
        username: userData.username,
        email: userData.email,
        profilePicture: userData.profilePicture,
        status: userData.status || 'offline',
        isEmailVerified: userData.isEmailVerified || false,
        role: userData.role || 'user'
      };
      
      console.log('✨ Transformed login user:', user);
      setUser(user);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  };

  const loginWithToken = async (token: string): Promise<void> => {
    try {
      localStorage.setItem('token', token);
      const response = await userAPI.getProfile();
      const userData = response.data as any;
      console.log('🔗 OAuth user data:', userData);
      
      // Transform user data
      const user: User = {
        id: userData._id || userData.id,
        username: userData.username,
        email: userData.email,
        profilePicture: userData.profilePicture,
        status: userData.status || 'offline',
        isEmailVerified: userData.isEmailVerified || false,
        role: userData.role || 'user'
      };
      
      console.log('✨ Transformed OAuth user:', user);
      setUser(user);
    } catch (error: any) {
      localStorage.removeItem('token');
      throw new Error('OAuth login failed');
    }
  };

  const register = async (username: string, email: string, password: string) => {
    try {
      const response = await authAPI.register(username, email, password);
      return response.data; // Return the response data
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Registration failed');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...userData });
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    loginWithToken,
    register,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
