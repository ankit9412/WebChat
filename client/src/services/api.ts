import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

// Configure axios defaults
axios.defaults.baseURL = API_BASE_URL;

// Add token to requests
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token expiration - IMPROVED VERSION
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    console.log('🚫 API Error intercepted:', {
      status: error.response?.status,
      url: error.config?.url,
      message: error.response?.data?.message
    });
    
    // Only auto-logout for actual authentication token errors
    if (error.response?.status === 401) {
      // Check if it's actually an auth token issue
      const isTokenError = 
        error.response?.data?.message?.toLowerCase().includes('token') ||
        error.response?.data?.message?.toLowerCase().includes('invalid') ||
        error.response?.data?.message?.toLowerCase().includes('expired') ||
        error.response?.data?.message === 'Access token required';
      
      // Don't auto-logout for call-related endpoints unless it's a token error
      const isCallEndpoint = error.config?.url?.includes('/calls/');
      
      if (isTokenError && !isCallEndpoint) {
        console.log('❌ Authentication token invalid, logging out');
        localStorage.removeItem('token');
        window.location.href = '/login';
      } else {
        console.warn('⚠️ 401 error but not logging out:', {
          isTokenError,
          isCallEndpoint,
          message: error.response?.data?.message
        });
      }
    }
    
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (email: string, password: string) =>
    axios.post('/auth/login', { email, password }),
  
  register: (username: string, email: string, password: string) =>
    axios.post('/auth/register', { username, email, password }),
  
  verifyEmail: (token: string) =>
    axios.get(`/auth/verify-email?token=${token}`),
  
  resendVerification: (email: string, method?: 'code' | 'both') =>
    axios.post('/auth/resend-verification', { email, method }),
  
  verifyCode: (email: string, code: string) =>
    axios.post('/auth/verify-code', { email, code }),
  
  forgotPassword: (email: string) =>
    axios.post('/auth/forgot-password', { email }),
  
  resetPassword: (token: string, newPassword: string) =>
    axios.post('/auth/reset-password', { token, newPassword }),
};

export const userAPI = {
  getProfile: () => axios.get('/users/profile'),
  
  updateProfile: (data: any) => axios.put('/users/profile', data),
  
  searchUsers: (query: string) => axios.get(`/users/search?query=${query}`),
  
  addFriend: (userId: string) => axios.post(`/users/friends/${userId}`),
  
  removeFriend: (userId: string) => axios.delete(`/users/friends/${userId}`),
  
  getFriends: () => axios.get('/users/friends'),
  
  blockUser: (userId: string) => axios.post(`/users/block/${userId}`),
  
  unblockUser: (userId: string) => axios.delete(`/users/block/${userId}`),
  
  updateStatus: (status: string) => axios.put('/users/status', { status }),
  
  getUser: (userId: string) => axios.get(`/users/${userId}`),
  
  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    
    return axios.post('/users/upload-avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const messageAPI = {
  sendMessage: (receiver: string, content: string, type: string = 'text', replyTo?: string) =>
    axios.post('/messages/send', { receiver, content, type, replyTo }),
  
  sendFile: (receiver: string, file: File, type: string = 'file', replyTo?: string) => {
    console.log('🚀 messageAPI.sendFile called with:', {
      receiver,
      receiverType: typeof receiver,
      receiverEmpty: !receiver,
      file: {
        name: file.name,
        size: file.size,
        type: file.type
      },
      messageType: type,
      replyTo,
      hasFile: !!file
    });
    
    // Validate parameters
    if (!receiver) {
      console.error('❌ messageAPI.sendFile: receiver is missing');
      throw new Error('Receiver is required');
    }
    if (!file) {
      console.error('❌ messageAPI.sendFile: file is missing');
      throw new Error('File is required');
    }
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('receiver', receiver);
    formData.append('type', type);
    if (replyTo) formData.append('replyTo', replyTo);
    
    console.log('📦 FormData contents:');
    // Log FormData entries (compatible with TypeScript)
    const formDataEntries: string[] = [];
    formData.forEach((value, key) => {
      if (value instanceof File) {
        formDataEntries.push(`- ${key}: ${value.name} (${value.size} bytes, ${value.type})`);
      } else {
        formDataEntries.push(`- ${key}: ${value}`);
      }
    });
    console.log(formDataEntries.join('\n'));
    
    console.log('🚀 Making POST request to /messages/send-file...');
    return axios.post('/messages/send-file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(response => {
      console.log('✅ messageAPI.sendFile successful:', response.data);
      return response;
    }).catch(error => {
      console.error('❌ messageAPI.sendFile error:', error.response?.data || error.message);
      throw error;
    });
  },
  
  getConversation: (userId: string, page: number = 1, limit: number = 50) =>
    axios.get(`/messages/conversation/${userId}?page=${page}&limit=${limit}`),
  
  markAsRead: (userId: string) =>
    axios.put(`/messages/mark-read/${userId}`),
  
  addReaction: (messageId: string, emoji: string) =>
    axios.post(`/messages/${messageId}/reaction`, { emoji }),
  
  removeReaction: (messageId: string) =>
    axios.delete(`/messages/${messageId}/reaction`),
  
  editMessage: (messageId: string, content: string) =>
    axios.put(`/messages/${messageId}`, { content }),
  
  deleteMessage: (messageId: string) =>
    axios.delete(`/messages/${messageId}`),
  
  getRecentConversations: () =>
    axios.get('/messages/conversations/recent'),
  
  markMessageDelivered: (messageId: string) =>
    axios.put(`/messages/mark-delivered/${messageId}`),
  
  markMessageRead: (messageId: string) =>
    axios.put(`/messages/mark-read-message/${messageId}`),
};

export const callAPI = {
  initiateCall: (receiver: string, type: 'audio' | 'video') => {
    console.log('📞 callAPI.initiateCall:', { receiver, type });
    return axios.post('/calls/initiate', { receiver, type })
      .then(response => {
        console.log('✅ Call initiated successfully:', response.data);
        return response;
      })
      .catch(error => {
        console.error('❌ Call initiation failed:', {
          status: error.response?.status,
          message: error.response?.data?.message,
          url: error.config?.url
        });
        throw error;
      });
  },
  
  answerCall: (callId: string) => {
    console.log('📞 callAPI.answerCall:', { callId });
    return axios.put(`/calls/${callId}/answer`)
      .then(response => {
        console.log('✅ Call answered successfully:', response.data);
        return response;
      })
      .catch(error => {
        console.error('❌ Call answer failed:', error.response?.data);
        throw error;
      });
  },
  
  rejectCall: (callId: string) => {
    console.log('📞 callAPI.rejectCall:', { callId });
    return axios.put(`/calls/${callId}/reject`)
      .then(response => {
        console.log('✅ Call rejected successfully:', response.data);
        return response;
      })
      .catch(error => {
        console.error('❌ Call rejection failed:', error.response?.data);
        throw error;
      });
  },
  
  endCall: (callId: string, quality?: any, recording?: any) => {
    console.log('📞 callAPI.endCall:', { callId, quality, recording });
    return axios.put(`/calls/${callId}/end`, { quality, recording })
      .then(response => {
        console.log('✅ Call ended successfully:', response.data);
        return response;
      })
      .catch(error => {
        console.error('❌ Call end failed:', error.response?.data);
        throw error;
      });
  },
  
  getCallHistory: (page: number = 1, limit: number = 20, type?: string) =>
    axios.get(`/calls/history?page=${page}&limit=${limit}&type=${type || ''}`),
  
  getCallStats: () =>
    axios.get('/calls/stats'),
  
  getActiveCalls: () =>
    axios.get('/calls/active'),
};

export default {
  auth: authAPI,
  user: userAPI,
  message: messageAPI,
  call: callAPI,
};
