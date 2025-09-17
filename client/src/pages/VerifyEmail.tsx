import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Button,
} from '@mui/material';
import { CheckCircle, Error } from '@mui/icons-material';
import { authAPI } from '../services/api';

const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');
      
      if (!token) {
        setStatus('error');
        setMessage('No verification token provided');
        return;
      }

    try {
      await authAPI.verifyEmail(token);
      setStatus('success');
      setMessage('Email verified successfully! You can now sign in to your account.');
    } catch (error: any) {
      setStatus('error');
      setMessage(error.response?.data?.message || 'Email verification failed');
    }
    };

    verifyEmail();
  }, [searchParams]);

  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          py: 4,
        }}
      >
        <Paper
          elevation={3}
          sx={{
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
            maxWidth: 400,
          }}
        >
          {status === 'loading' && (
            <>
              <CircularProgress size={60} sx={{ mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                Verifying your email...
              </Typography>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
              <Typography variant="h5" color="success.main" gutterBottom>
                Email Verified!
              </Typography>
              <Alert severity="success" sx={{ width: '100%', mb: 2 }}>
                {message}
              </Alert>
              <Button
                component={Link}
                to="/login"
                variant="contained"
                size="large"
                sx={{ mt: 2 }}
              >
                Sign In
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              <Error sx={{ fontSize: 60, color: 'error.main', mb: 2 }} />
              <Typography variant="h5" color="error.main" gutterBottom>
                Verification Failed
              </Typography>
              <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
                {message}
              </Alert>
              <Button
                component={Link}
                to="/login"
                variant="contained"
                size="large"
                sx={{ mt: 2 }}
              >
                Back to Sign In
              </Button>
            </>
          )}
        </Paper>
      </Box>
    </Container>
  );
};

export default VerifyEmail;
