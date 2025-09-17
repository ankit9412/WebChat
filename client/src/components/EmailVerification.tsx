import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Divider,
  Link,
  Grid,
  Chip,
} from '@mui/material';
import {
  Email as EmailIcon,
  Security as SecurityIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  Link as LinkIcon,
  Code as CodeIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { authAPI } from '../services/api';

interface EmailVerificationProps {
  email?: string;
  onVerified?: () => void;
}

const EmailVerification: React.FC<EmailVerificationProps> = ({ email: propEmail, onVerified }) => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Get email from props, location state, or URL params
  const email = propEmail || location.state?.email || searchParams.get('email') || '';
  const token = searchParams.get('token');
  
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState(5);
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-verify if token is present in URL
  useEffect(() => {
    const verifyWithToken = async () => {
      try {
        setLoading(true);
        const response = await authAPI.verifyEmail(token!);
        setMessage((response.data as any).message);
        setVerified(true);
        if (onVerified) onVerified();
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login', { state: { message: 'Email verified successfully! You can now log in.' } });
        }, 3000);
        
      } catch (error: any) {
        setError(error.response?.data?.message || 'Token verification failed');
      } finally {
        setLoading(false);
      }
    };
    
    if (token) {
      verifyWithToken();
    }
  }, [token, navigate, onVerified]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);


  const verifyWithCode = async () => {
    const code = verificationCode.join('');
    
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    if (!email) {
      setError('Email address is required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const response = await authAPI.verifyCode(email, code);
      setMessage((response.data as any).message);
      setVerified(true);
      if (onVerified) onVerified();
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login', { state: { message: 'Email verified successfully! You can now log in.' } });
      }, 3000);
      
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Code verification failed';
      setError(errorMessage);
      
      if (error.response?.data?.attemptsRemaining !== undefined) {
        setAttemptsRemaining(error.response.data.attemptsRemaining);
      }
      
      // Clear the code inputs on error
      setVerificationCode(['', '', '', '', '', '']);
      if (inputRefs.current[0]) {
        inputRefs.current[0].focus();
      }
    } finally {
      setLoading(false);
    }
  };

  const resendVerification = async (method: 'code' | 'both' = 'code') => {
    if (!email) {
      setError('Email address is required');
      return;
    }

    try {
      setResendLoading(true);
      setError('');
      
      const response = await authAPI.resendVerification(email, method);
      setMessage((response.data as any).message);
      setTimeLeft(600); // 10 minutes
      setAttemptsRemaining(5); // Reset attempts
      
      // Clear the code inputs
      setVerificationCode(['', '', '', '', '', '']);
      if (inputRefs.current[0]) {
        inputRefs.current[0].focus();
      }
      
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to resend verification');
    } finally {
      setResendLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits
    
    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);

    // Auto-move to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits are entered
    if (index === 5 && value && newCode.every(digit => digit !== '')) {
      setTimeout(verifyWithCode, 100);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (verified) {
    return (
      <Box
        component="main"
        sx={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}
      >
        <Paper
          elevation={10}
          sx={{
            padding: 4,
            maxWidth: 500,
            width: '100%',
            margin: 2,
            textAlign: 'center',
            borderRadius: 3,
          }}
        >
          <CheckCircleIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
          <Typography variant="h4" gutterBottom color="success.main">
            Email Verified!
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            {message}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Redirecting to login page...
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box
      component="main"
      sx={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Paper
        elevation={10}
        sx={{
          padding: 4,
          maxWidth: 500,
          width: '100%',
          margin: 2,
          borderRadius: 3,
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <SecurityIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
          <Typography variant="h4" gutterBottom>
            Verify Your Email
          </Typography>
          <Typography variant="body1" color="text.secondary">
            We've sent a verification email to:
          </Typography>
          <Chip
            icon={<EmailIcon />}
            label={email || 'your email address'}
            variant="outlined"
            sx={{ mt: 1, mb: 2 }}
          />
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
            {attemptsRemaining < 5 && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                Attempts remaining: {attemptsRemaining}
              </Typography>
            )}
          </Alert>
        )}

        {message && !error && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {message}
          </Alert>
        )}

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CodeIcon />
            Enter Verification Code
          </Typography>
          
          <Grid container spacing={1} justifyContent="center" sx={{ mb: 2 }}>
            {verificationCode.map((digit, index) => (
              <Grid key={index} sx={{ flexBasis: 'auto' }}>
                <TextField
                  inputRef={(el) => (inputRefs.current[index] = el)}
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  inputProps={{
                    maxLength: 1,
                    style: { textAlign: 'center', fontSize: '24px', fontWeight: 'bold' },
                  }}
                  sx={{
                    width: 60,
                    '& .MuiOutlinedInput-root': {
                      '&.Mui-focused fieldset': {
                        borderColor: 'primary.main',
                        borderWidth: 2,
                      },
                    },
                  }}
                />
              </Grid>
            ))}
          </Grid>

          {timeLeft > 0 && (
            <Typography variant="body2" color="warning.main" textAlign="center">
              Code expires in: {formatTime(timeLeft)}
            </Typography>
          )}
        </Box>

        <Button
          variant="contained"
          fullWidth
          onClick={verifyWithCode}
          disabled={loading || verificationCode.join('').length !== 6}
          sx={{ mb: 2, py: 1.5 }}
        >
          {loading ? <CircularProgress size={24} /> : 'Verify Code'}
        </Button>

        <Divider sx={{ my: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Didn't receive the code?
          </Typography>
        </Divider>

        <Grid container spacing={2}>
          <Grid sx={{ flex: '1' }}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<RefreshIcon />}
              onClick={() => resendVerification('code')}
              disabled={resendLoading}
              sx={{ py: 1 }}
            >
              {resendLoading ? <CircularProgress size={20} /> : 'Resend Code'}
            </Button>
          </Grid>
          <Grid sx={{ flex: '1' }}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<LinkIcon />}
              onClick={() => resendVerification('both')}
              disabled={resendLoading}
              sx={{ py: 1 }}
            >
              {resendLoading ? <CircularProgress size={20} /> : 'Send Link'}
            </Button>
          </Grid>
        </Grid>

        <Box sx={{ textAlign: 'center', mt: 3 }}>
          <Typography variant="body2" color="text.secondary">
            Already verified?{' '}
            <Link
              component="button"
              variant="body2"
              onClick={() => navigate('/login')}
              sx={{ textDecoration: 'none' }}
            >
              Sign In
            </Link>
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default EmailVerification;