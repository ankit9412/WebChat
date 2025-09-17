import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box } from '@mui/material';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import Login from './pages/Login';
import Register from './pages/Register';
import EmailVerification from './components/EmailVerification';
import ResetPassword from './pages/ResetPassword';
import Chat from './pages/Chat';
import ParticleBackground from './components/ParticleBackground';
import './App.css';
import './styles/animations.css';
import './styles/3d-theme.css';

// Create 3D theme
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#667eea',
    },
    secondary: {
      main: '#f093fb',
    },
    background: {
      default: 'transparent',
      paper: 'rgba(255, 255, 255, 0.1)',
    },
    text: {
      primary: '#ffffff',
      secondary: 'rgba(255, 255, 255, 0.7)',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 600 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 500 },
    h6: { fontWeight: 500 },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: '15px',
          fontWeight: 600,
          padding: '12px 24px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 25px rgba(102, 126, 234, 0.4)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '20px',
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        },
      },
    },
  },
});

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
      >
        <div>Loading...</div>
      </Box>
    );
  }
  
  return user ? <>{children}</> : <Navigate to="/login" />;
};

// Public Route Component (redirect if authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
      >
        <div>Loading...</div>
      </Box>
    );
  }
  
  if (user) {
    // Redirect authenticated users to chat
    return <Navigate to="/chat" />;
  }
  
  return <>{children}</>;
};


function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <SocketProvider>
          <Router>
            <Box sx={{ 
              minHeight: '100vh', 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 20%, #f093fb 40%, #f5576c 60%, #4facfe 80%, #00f2fe 100%)',
              backgroundSize: '400% 400%',
              animation: 'gradientShift 15s ease infinite',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <ParticleBackground />
              <Routes>
                <Route 
                  path="/login" 
                  element={
                    <PublicRoute>
                      <Login />
                    </PublicRoute>
                  } 
                />
                <Route 
                  path="/register" 
                  element={
                    <PublicRoute>
                      <Register />
                    </PublicRoute>
                  } 
                />
                <Route 
                  path="/verify-email" 
                  element={
                    <PublicRoute>
                      <EmailVerification />
                    </PublicRoute>
                  } 
                />
                <Route 
                  path="/reset-password" 
                  element={
                    <PublicRoute>
                      <ResetPassword />
                    </PublicRoute>
                  } 
                />
                <Route 
                  path="/chat" 
                  element={
                    <ProtectedRoute>
                      <Chat />
                    </ProtectedRoute>
                  } 
                />
                <Route path="/" element={<Navigate to="/chat" />} />
              </Routes>
            </Box>
          </Router>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;