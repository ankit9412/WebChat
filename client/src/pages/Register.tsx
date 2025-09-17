import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  Divider,
  Chip,
  Grid,
  LinearProgress,
  Tooltip,
  useTheme,
  alpha,
  Card,
  CardContent,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Email,
  Lock,
  Person,
  PersonAdd,
  Google,
  Facebook,
  GitHub,
  Check,
  Close,
  Security,
  PhotoCamera,
} from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useAuth } from '../contexts/AuthContext';

const schema = yup.object({
  username: yup
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be less than 20 characters')
    .matches(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .required('Username is required'),
  email: yup
    .string()
    .email('Invalid email format')
    .required('Email is required'),
  password: yup
    .string()
    .min(8, 'Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number')
    .required('Password is required'),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('password')], 'Passwords must match')
    .required('Please confirm your password'),
});

type FormData = yup.InferType<typeof schema>;

const Register: React.FC = () => {
  const theme = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [passwordValue, setPasswordValue] = useState('');
  const [usernameValue, setUsernameValue] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const { register: registerUser } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<FormData>({
    resolver: yupResolver(schema),
  });

  // Password strength checker
  const getPasswordStrength = (password: string) => {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;
    return { score, max: 5 };
  };

  const getPasswordStrengthColor = (score: number) => {
    if (score < 2) return theme.palette.error.main;
    if (score < 4) return theme.palette.warning.main;
    return theme.palette.success.main;
  };

  const getPasswordStrengthText = (score: number) => {
    if (score < 2) return 'Weak';
    if (score < 4) return 'Medium';
    return 'Strong';
  };

  // Check username availability (simulated)
  const checkUsernameAvailability = async (username: string) => {
    if (username.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    
    setIsCheckingUsername(true);
    // Simulate API call
    setTimeout(() => {
      const unavailableUsernames = ['admin', 'test', 'user', 'guest'];
      setUsernameAvailable(!unavailableUsernames.includes(username.toLowerCase()));
      setIsCheckingUsername(false);
    }, 500);
  };

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError('');

    try {
      const response = await registerUser(data.username, data.email, data.password);
      
      // Check if verification is required
      if (response && response.verificationRequired) {
        // Redirect to verification page with email
        navigate('/verify-email', { 
          state: { 
            email: data.email,
            message: 'Registration successful! Please check your email for verification instructions.' 
          } 
        });
      } else {
        // Fallback to login page
        setSuccess(true);
        setTimeout(() => {
          navigate('/login', {
            state: { message: 'Registration successful! You can now log in.' }
          });
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePassword = () => {
    setShowPassword(!showPassword);
  };

  const handleToggleConfirmPassword = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  // Social login handlers
  const handleGoogleSignup = () => {
    window.location.href = 'http://localhost:5001/api/auth/google';
  };

  const handleFacebookSignup = () => {
    window.location.href = 'http://localhost:5001/api/auth/facebook';
  };

  const handleGitHubSignup = () => {
    window.location.href = 'http://localhost:5001/api/auth/github';
  };

  // Real-time password and username checking
  React.useEffect(() => {
    const subscription = watch((value, { name }) => {
      if (name === 'password') {
        setPasswordValue(value.password || '');
      }
      if (name === 'username') {
        const username = value.username || '';
        setUsernameValue(username);
        if (username !== usernameValue) {
          checkUsernameAvailability(username);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, usernameValue]);

  if (success) {
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
            <Alert severity="success" sx={{ width: '100%', mb: 2 }}>
              Registration successful! Please check your email to verify your account.
            </Alert>
            <CircularProgress />
          </Paper>
        </Box>
      </Container>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 15%, #ff3838 30%, #c44569 45%, #f8b500 60%, #ff6348 75%, #e55039 90%, #b71540 100%)',
        backgroundSize: '400% 400%',
        animation: 'gradientAnimation 15s ease infinite',
        position: 'relative',
        overflow: 'hidden',
        '@keyframes gradientAnimation': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
      }}
    >
      {/* Floating 3D Elements */}
      {[...Array(20)].map((_, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            width: Math.random() * 60 + 20,
            height: Math.random() * 60 + 20,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${['#ff6b6b', '#ee5a24', '#ff3838', '#c44569', '#f8b500', '#ff6348', '#e55039'][Math.floor(Math.random() * 7)]}, ${['#ff4757', '#ff3742', '#ff6348', '#c44569', '#f39801', '#e55039', '#b71540'][Math.floor(Math.random() * 7)]})`,
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            animation: `float ${3 + Math.random() * 4}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 2}s`,
            opacity: 0.7,
            zIndex: 1,
            '@keyframes float': {
              '0%, 100%': { transform: 'translateY(0px) rotate(0deg) scale(1)' },
              '33%': { transform: 'translateY(-20px) rotate(120deg) scale(1.1)' },
              '66%': { transform: 'translateY(10px) rotate(240deg) scale(0.9)' },
            },
          }}
        />
      ))}

      <Container maxWidth="md" sx={{ position: 'relative', zIndex: 2, py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Paper
            className="glass-card card-stack"
            elevation={0}
            sx={{
              p: 6,
              width: '100%',
              maxWidth: 520,
              borderRadius: '25px',
              background: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(30px)',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 35px 80px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
              position: 'relative',
              overflow: 'hidden',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                transform: 'translateY(-10px) scale(1.02)',
                boxShadow: '0 50px 100px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
              },
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: '-100%',
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent)',
                animation: 'shine 3s infinite',
                '@keyframes shine': {
                  '0%': { left: '-100%' },
                  '50%': { left: '100%' },
                  '100%': { left: '100%' }
                }
              }
            }}
          >
            {/* 3D Logo Header */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                mb: 4,
                position: 'relative',
                zIndex: 2,
              }}
            >
              <Box
                className="floating"
                sx={{
                  width: 100,
                  height: 100,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 50%, #ff3838 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 2,
                  boxShadow: '0 20px 60px rgba(102, 126, 234, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                  border: '3px solid rgba(255, 255, 255, 0.3)',
                  position: 'relative',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: -5,
                    left: -5,
                    right: -5,
                    bottom: -5,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4)',
                    zIndex: -1,
                    animation: 'rotate 4s linear infinite',
                    '@keyframes rotate': {
                      '0%': { transform: 'rotate(0deg)' },
                      '100%': { transform: 'rotate(360deg)' }
                    }
                  }
                }}
              >
                <PersonAdd sx={{ fontSize: 50, color: 'white', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }} />
              </Box>
              
              <Typography 
                component="h1" 
                variant="h3" 
                className="holographic"
                sx={{
                  fontWeight: 800,
                  mb: 1,
                  textAlign: 'center',
                  background: 'linear-gradient(45deg, #ff6b6b, #ee5a24, #ff3838, #c44569)',
                  backgroundSize: '400% 400%',
                  animation: 'holographicShift 3s ease infinite',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                }}
              >
                Web Chat
              </Typography>
              
              <Typography 
                variant="h6" 
                sx={{ 
                  color: 'rgba(255, 255, 255, 0.9)', 
                  fontWeight: 300,
                  textAlign: 'center',
                  textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                }}
              >
                by Ankit Kumar
              </Typography>
            </Box>

            <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
              Create your account to get started
            </Typography>

            {error && (
              <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
                {error}
              </Alert>
            )}

            {/* Social Login Section */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2 }}>
                Sign up with
              </Typography>
              <Grid container spacing={2}>
                {/* @ts-expect-error MUI Grid type issue */}
                <Grid item xs={4}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={handleGoogleSignup}
                    sx={{
                      py: 1.5,
                      borderColor: '#4285f4',
                      color: '#4285f4',
                      '&:hover': {
                        borderColor: '#3367d6',
                        backgroundColor: alpha('#4285f4', 0.04),
                      },
                    }}
                    startIcon={<Google />}
                  >
                    Google
                  </Button>
                </Grid>
                {/* @ts-expect-error MUI Grid type issue */}
                <Grid item xs={4}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={handleFacebookSignup}
                    sx={{
                      py: 1.5,
                      borderColor: '#1877f2',
                      color: '#1877f2',
                      '&:hover': {
                        borderColor: '#166fe5',
                        backgroundColor: alpha('#1877f2', 0.04),
                      },
                    }}
                    startIcon={<Facebook />}
                  >
                    Facebook
                  </Button>
                </Grid>
                {/* @ts-expect-error MUI Grid type issue */}
                <Grid item xs={4}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={handleGitHubSignup}
                    sx={{
                      py: 1.5,
                      borderColor: '#333',
                      color: '#333',
                      '&:hover': {
                        borderColor: '#24292e',
                        backgroundColor: alpha('#333', 0.04),
                      },
                    }}
                    startIcon={<GitHub />}
                  >
                    GitHub
                  </Button>
                </Grid>
              </Grid>
              
              <Box sx={{ display: 'flex', alignItems: 'center', my: 3 }}>
                <Divider sx={{ flex: 1 }} />
                <Chip label="OR" size="small" sx={{ mx: 2, backgroundColor: 'background.paper' }} />
                <Divider sx={{ flex: 1 }} />
              </Box>
            </Box>

            <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ width: '100%' }}>
              {/* Username Field with Real-time Validation */}
              <TextField
                {...register('username')}
                margin="normal"
                required
                fullWidth
                id="username"
                label="Username"
                name="username"
                autoComplete="username"
                autoFocus
                error={!!errors.username || (usernameAvailable === false)}
                helperText={
                  errors.username?.message ||
                  (usernameAvailable === false ? 'Username is already taken' : 
                   usernameAvailable === true ? 'Username is available' : '')
                }
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Person color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      {isCheckingUsername && <CircularProgress size={16} />}
                      {!isCheckingUsername && usernameAvailable === true && <Check sx={{ color: 'success.main' }} />}
                      {!isCheckingUsername && usernameAvailable === false && <Close sx={{ color: 'error.main' }} />}
                    </InputAdornment>
                  ),
                }}
                FormHelperTextProps={{
                  sx: { color: usernameAvailable === true ? 'success.main' : undefined }
                }}
              />

              <TextField
                {...register('email')}
                margin="normal"
                required
                fullWidth
                id="email"
                label="Email Address"
                name="email"
                autoComplete="email"
                error={!!errors.email}
                helperText={errors.email?.message}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email color="action" />
                    </InputAdornment>
                  ),
                }}
              />
              
              {/* Enhanced Password Field with Strength Indicator */}
              <TextField
                {...register('password')}
                margin="normal"
                required
                fullWidth
                name="password"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                id="password"
                autoComplete="new-password"
                error={!!errors.password}
                helperText={errors.password?.message}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={handleTogglePassword}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              
              {/* Password Strength Indicator */}
              {passwordValue && (
                <Box sx={{ mt: 1, mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Security sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                    <Typography variant="caption" color="text.secondary">
                      Password strength: 
                    </Typography>
                    <Chip
                      label={getPasswordStrengthText(getPasswordStrength(passwordValue).score)}
                      size="small"
                      sx={{
                        ml: 1,
                        fontSize: '10px',
                        backgroundColor: alpha(getPasswordStrengthColor(getPasswordStrength(passwordValue).score), 0.1),
                        color: getPasswordStrengthColor(getPasswordStrength(passwordValue).score),
                      }}
                    />
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={(getPasswordStrength(passwordValue).score / getPasswordStrength(passwordValue).max) * 100}
                    sx={{
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: alpha(theme.palette.grey[500], 0.2),
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: getPasswordStrengthColor(getPasswordStrength(passwordValue).score),
                        borderRadius: 2,
                      },
                    }}
                  />
                </Box>
              )}

              <TextField
                {...register('confirmPassword')}
                margin="normal"
                required
                fullWidth
                name="confirmPassword"
                label="Confirm Password"
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                autoComplete="new-password"
                error={!!errors.confirmPassword}
                helperText={errors.confirmPassword?.message}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle confirm password visibility"
                        onClick={handleToggleConfirmPassword}
                        edge="end"
                      >
                        {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                sx={{
                  mt: 3,
                  mb: 2,
                  py: 1.5,
                  background: 'linear-gradient(45deg, #ff6b6b, #ee5a24)',
                  boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #5a67d8, #6b46c1)',
                    boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)',
                    transform: 'translateY(-1px)',
                  },
                  transition: 'all 0.3s ease',
                }}
                disabled={loading || usernameAvailable === false}
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <PersonAdd />}
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </Button>

              <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Typography variant="body2">
                  Already have an account?{' '}
                  <Link to="/login" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <Typography component="span" color="primary" sx={{ fontWeight: 'bold', '&:hover': { textDecoration: 'underline' } }}>
                      Sign in
                    </Typography>
                  </Link>
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Box>
      </Container>
    </Box>
  );
};

export default Register;
