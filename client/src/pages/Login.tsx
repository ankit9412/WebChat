import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
  Grid,
  Card,
  Chip,
  Divider,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Email,
  Lock,
  Login as LoginIcon,
  Chat as ChatIcon,
  People as PeopleIcon,
  Favorite as FavoriteIcon,
  Star as StarIcon,
  EmojiEmotions as EmojiIcon,
  PhotoCamera as PhotoIcon,
  VideoCameraFront as VideoIcon,
  MusicNote as MusicIcon,
  GitHub,
  Google,
  Facebook,
} from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useAuth } from '../contexts/AuthContext';

const schema = yup.object({
  email: yup
    .string()
    .email('Invalid email format')
    .required('Email is required'),
  password: yup
    .string()
    .min(6, 'Password must be at least 6 characters')
    .required('Password is required'),
});

type FormData = yup.InferType<typeof schema>;

const Login: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, loginWithToken } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: yupResolver(schema),
  });

  // Handle OAuth callback token
  React.useEffect(() => {
    const token = searchParams.get('token');
    const provider = searchParams.get('provider');
    const error = searchParams.get('error');
    
    if (error) {
      let errorMessage = 'Authentication failed';
      
      switch (error) {
        case 'google_not_configured':
          errorMessage = 'Google OAuth is not configured. Please contact administrator.';
          break;
        case 'facebook_not_configured':
          errorMessage = 'Facebook OAuth is not configured. Please contact administrator.';
          break;
        case 'github_not_configured':
          errorMessage = 'GitHub OAuth is not configured. Please contact administrator.';
          break;
        case 'google_auth_failed':
          errorMessage = 'Google authentication failed. Please try again.';
          break;
        case 'facebook_auth_failed':
          errorMessage = 'Facebook authentication failed. Please try again.';
          break;
        case 'github_auth_failed':
          errorMessage = 'GitHub authentication failed. Please try again.';
          break;
        default:
          errorMessage = `Authentication failed: ${error.replace(/_/g, ' ')}`;
      }
      
      setError(errorMessage);
    } else if (token && provider) {
      // Use OAuth token to login
      const handleOAuthLogin = async () => {
        setLoading(true);
        try {
          await loginWithToken(token);
          setError('');
          navigate('/chat');
        } catch (err: any) {
          setError('OAuth login failed: ' + err.message);
        } finally {
          setLoading(false);
        }
      };
      
      handleOAuthLogin();
    }
  }, [searchParams, navigate, loginWithToken]);

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError('');

    try {
      await login(data.email, data.password);
      navigate('/chat');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePassword = () => {
    setShowPassword(!showPassword);
  };

  // Feature highlights for the left side
  const features = [
    {
      icon: <ChatIcon sx={{ fontSize: 60, color: '#1877F2' }} />,
      title: 'Connect with Friends',
      description: 'Chat instantly with people around the world',
      color: '#E3F2FD'
    },
    {
      icon: <VideoIcon sx={{ fontSize: 60, color: '#42A5F5' }} />,
      title: 'Video & Voice Calls',
      description: 'Make crystal clear video and voice calls',
      color: '#F3E5F5'
    },
    {
      icon: <PhotoIcon sx={{ fontSize: 60, color: '#66BB6A' }} />,
      title: 'Share Memories',
      description: 'Share photos, videos, and precious moments',
      color: '#E8F5E8'
    },
    {
      icon: <MusicIcon sx={{ fontSize: 60, color: '#FF7043' }} />,
      title: 'Express Yourself',
      description: 'Send voice messages and express emotions',
      color: '#FFF3E0'
    },
  ];

  const floatingElements = [
    { icon: EmojiIcon, color: '#ff6b6b', top: '15%', left: '10%', delay: '0s' },
    { icon: FavoriteIcon, color: '#ee5a24', top: '25%', right: '15%', delay: '0.5s' },
    { icon: StarIcon, color: '#ff3838', top: '45%', left: '5%', delay: '1s' },
    { icon: PeopleIcon, color: '#c44569', top: '60%', right: '20%', delay: '1.5s' },
    { icon: ChatIcon, color: '#f8b500', top: '75%', left: '12%', delay: '2s' },
    { icon: VideoIcon, color: '#ff6348', top: '30%', right: '5%', delay: '2.5s' },
    { icon: PhotoIcon, color: '#e55039', top: '10%', right: '8%', delay: '3s' },
    { icon: MusicIcon, color: '#b71540', top: '80%', right: '10%', delay: '3.5s' },
  ];

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
      {/* Enhanced 3D Floating Elements */}
      {floatingElements.map((element, index) => {
        const IconComponent = element.icon;
        return (
          <Box
            key={index}
            className="floating"
            sx={{
              position: 'absolute',
              top: element.top,
              left: element.left,
              right: element.right,
              zIndex: 1,
              width: 60,
              height: 60,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${element.color}, ${element.color}88)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 10px 30px ${element.color}40`,
              border: '2px solid rgba(255, 255, 255, 0.3)',
              backdropFilter: 'blur(10px)',
              animation: `float3d ${3 + index * 0.5}s ease-in-out infinite`,
              animationDelay: element.delay,
              '@keyframes float3d': {
                '0%, 100%': { 
                  transform: 'translateY(0px) rotate(0deg) scale(1)',
                  boxShadow: `0 10px 30px ${element.color}40`
                },
                '33%': { 
                  transform: 'translateY(-15px) rotate(120deg) scale(1.1)',
                  boxShadow: `0 20px 50px ${element.color}60`
                },
                '66%': { 
                  transform: 'translateY(5px) rotate(240deg) scale(0.9)',
                  boxShadow: `0 5px 20px ${element.color}30`
                },
              },
            }}
          >
            <IconComponent
              sx={{
                fontSize: 30,
                color: 'white',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
              }}
            />
          </Box>
        );
      })}

      {/* Additional Colorful Particles */}
      {[...Array(15)].map((_, i) => (
        <Box
          key={`particle-${i}`}
          sx={{
            position: 'absolute',
            width: Math.random() * 40 + 10,
            height: Math.random() * 40 + 10,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${['#ff6b6b', '#ee5a24', '#ff3838', '#c44569', '#f8b500', '#ff6348', '#e55039', '#b71540'][Math.floor(Math.random() * 8)]}, ${['#ff4757', '#ff3742', '#ff6348', '#c44569', '#f39801', '#e55039', '#b71540', '#8e44ad'][Math.floor(Math.random() * 8)]})`,
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            animation: `particleFloat ${4 + Math.random() * 6}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 3}s`,
            opacity: 0.6,
            zIndex: 1,
            '@keyframes particleFloat': {
              '0%, 100%': { transform: 'translateY(0px) rotate(0deg) scale(1)' },
              '25%': { transform: 'translateY(-30px) rotate(90deg) scale(1.2)' },
              '50%': { transform: 'translateY(-10px) rotate(180deg) scale(0.8)' },
              '75%': { transform: 'translateY(-20px) rotate(270deg) scale(1.1)' },
            },
          }}
        />
      ))}

      <Container maxWidth="xl" sx={{ position: 'relative', zIndex: 2 }}>
        <Grid container spacing={4} sx={{ minHeight: '100vh', alignItems: 'center' }}>
          {/* Left Side - Features Showcase */}
          {/* @ts-expect-error MUI Grid type issue */}
          <Grid item xs={12} lg={7} sx={{ display: { xs: 'none', lg: 'block' } }}>
            <Box sx={{ px: 4 }}>
              {/* Main Logo and Title */}
              <Box sx={{ mb: 6, textAlign: 'center' }}>
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 120,
                    height: 120,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #ff6b6b, #ee5a24, #ff3838)',
                    boxShadow: '0 20px 40px rgba(102, 126, 234, 0.4)',
                    mb: 3,
                    animation: 'logoFloat 4s ease-in-out infinite',
                    '@keyframes logoFloat': {
                      '0%, 100%': { transform: 'translateY(0px) scale(1)' },
                      '50%': { transform: 'translateY(-10px) scale(1.05)' },
                    },
                  }}
                >
                  <ChatIcon sx={{ fontSize: 60, color: 'white' }} />
                </Box>
                <Typography
                  variant="h2"
                  sx={{
                    fontWeight: 800,
                    background: 'linear-gradient(45deg, #ff6b6b, #ee5a24, #ff3838)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    mb: 2,
                    textShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  }}
                >
                  Web Chat
                </Typography>
                <Typography
                  variant="h4"
                  sx={{
                    color: 'rgba(255,255,255,0.9)',
                    fontWeight: 300,
                    mb: 2,
                  }}
                >
                  by Ankit Kumar
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    color: 'rgba(255,255,255,0.8)',
                    fontStyle: 'italic',
                  }}
                >
                  Connect • Chat • Share • Explore
                </Typography>
              </Box>

              {/* Feature Cards */}
              <Grid container spacing={3}>
                {features.map((feature, index) => (
                  <React.Fragment key={index}>
                    {/* @ts-expect-error MUI Grid type issue */}
                    <Grid item xs={12} sm={6}>
                    <Card
                      sx={{
                        background: 'rgba(255,255,255,0.1)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: 4,
                        p: 3,
                        textAlign: 'center',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        cursor: 'pointer',
                        '&:hover': {
                          transform: 'translateY(-8px) scale(1.02)',
                          boxShadow: '0 20px 40px rgba(255,255,255,0.2)',
                          background: 'rgba(255,255,255,0.15)',
                        },
                      }}
                    >
                      <Box
                        sx={
                          {
                            width: 80,
                            height: 80,
                            borderRadius: '50%',
                            background: feature.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mx: 'auto',
                            mb: 2,
                            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                          }
                        }
                      >
                        {feature.icon}
                      </Box>
                      <Typography
                        variant="h6"
                        sx={{ color: 'white', fontWeight: 600, mb: 1 }}
                      >
                        {feature.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ color: 'rgba(255,255,255,0.8)' }}
                      >
                        {feature.description}
                      </Typography>
                    </Card>
                    </Grid>
                  </React.Fragment>
                ))}
              </Grid>
            </Box>
          </Grid>

          {/* Right Side - Login Form */}
          {/* @ts-expect-error MUI Grid type issue */}
          <Grid item xs={12} lg={5}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', px: 2 }}>
              {/* Stylish Web Chat Logo */}
              <Box sx={{ 
                position: 'relative',
                mb: 4,
                display: { xs: 'flex', lg: 'none' }, // Show only on mobile, hidden on large screens
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center'
              }}>
                {/* Create stylish PNG-like logo with CSS */}
                <Box sx={{
                  position: 'relative',
                  width: 180,
                  height: 60,
                  background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 50%, #ff3838 100%)',
                  borderRadius: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 15px 35px rgba(102, 126, 234, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                  border: '2px solid rgba(255, 255, 255, 0.2)',
                  overflow: 'hidden',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: '-100%',
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent)',
                    animation: 'shine 3s infinite',
                  },
                  '@keyframes shine': {
                    '0%': { left: '-100%' },
                    '50%': { left: '100%' },
                    '100%': { left: '100%' }
                  }
                }}>
                  <ChatIcon sx={{ fontSize: 32, color: 'white', mr: 1, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} />
                  <Typography variant="h4" sx={{
                    color: 'white',
                    fontWeight: 800,
                    fontFamily: 'Arial, sans-serif',
                    textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    letterSpacing: '1px'
                  }}>
                    Web Chat
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ 
                  color: 'rgba(255,255,255,0.9)', 
                  mt: 1, 
                  fontStyle: 'italic',
                  textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                }}>
                  Connect • Chat • Share
                </Typography>
              </Box>
              <Paper
                className="glass-card card-stack"
                elevation={0}
                sx={{
                  p: 6,
                  width: '100%',
                  maxWidth: 480,
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
                {/* 3D Login Form Header */}
                <Box sx={{ textAlign: 'center', mb: 4, position: 'relative', zIndex: 2 }}>
                  <Box
                    className="floating neon-glow"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 120,
                      height: 120,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 50%, #ff3838 100%)',
                      mb: 3,
                      boxShadow: '0 20px 60px rgba(255, 107, 107, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                      border: '3px solid rgba(255, 255, 255, 0.3)',
                      color: '#667eea',
                      position: 'relative',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: -5,
                        left: -5,
                        right: -5,
                        bottom: -5,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #ff6b6b, #ee5a24, #ff3838, #c44569, #f8b500, #ff6348)',
                        zIndex: -1,
                        animation: 'rotate 4s linear infinite',
                        '@keyframes rotate': {
                          '0%': { transform: 'rotate(0deg)' },
                          '100%': { transform: 'rotate(360deg)' }
                        }
                      }
                    }}
                  >
                    <LoginIcon sx={{ fontSize: 60, color: 'white', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }} />
                  </Box>
                  
                  <Typography
                    variant="h3"
                    className="holographic"
                    sx={{
                      fontWeight: 800,
                      mb: 2,
                      background: 'linear-gradient(45deg, #ff6b6b, #ee5a24, #ff3838, #c44569)',
                      backgroundSize: '400% 400%',
                      animation: 'holographicShift 3s ease infinite',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                    }}
                  >
                    Welcome Back!
                  </Typography>
                  
                  <Typography
                    variant="h6"
                    sx={{
                      color: 'rgba(255, 255, 255, 0.9)',
                      mb: 2,
                      fontWeight: 300,
                      textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                    }}
                  >
                    Sign in to continue your conversations
                  </Typography>

                  {/* Fun Stats */}
                  <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 3 }}>
                    <Chip
                      icon={<PeopleIcon />}
                      label="1M+ Users"
                      sx={{
                        background: 'linear-gradient(45deg, #FF6B6B, #FF8E8E)',
                        color: 'white',
                        fontWeight: 600,
                      }}
                    />
                    <Chip
                      icon={<ChatIcon />}
                      label="10M+ Messages"
                      sx={{
                        background: 'linear-gradient(45deg, #4ECDC4, #44A08D)',
                        color: 'white',
                        fontWeight: 600,
                      }}
                    />
                  </Box>
                </Box>

                {/* Alerts */}
                {searchParams.get('message') && (
                  <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>
                    {searchParams.get('message')}
                  </Alert>
                )}

                {error && (
                  <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                    {error}
                  </Alert>
                )}

                {/* Login Form */}
                <Box component="form" onSubmit={handleSubmit(onSubmit)}>
                  <TextField
                    {...register('email')}
                    fullWidth
                    label="Email address or mobile number"
                    variant="outlined"
                    margin="normal"
                    autoFocus
                    error={!!errors.email}
                    helperText={errors.email?.message}
                    className="glass-card"
                    sx={{
                      mb: 2,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '15px',
                        background: 'rgba(255, 255, 255, 0.2)',
                        backdropFilter: 'blur(15px)',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        fontSize: '16px',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&:hover': {
                          background: 'rgba(255, 255, 255, 0.25)',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 8px 32px rgba(102, 126, 234, 0.2)',
                        },
                        '&.Mui-focused': {
                          background: 'rgba(255, 255, 255, 0.3)',
                          boxShadow: '0 0 0 3px rgba(102, 126, 234, 0.3), 0 8px 32px rgba(102, 126, 234, 0.2)',
                          transform: 'translateY(-3px)',
                        },
                      },
                      '& .MuiOutlinedInput-input': {
                        py: 2,
                        px: 2,
                        color: 'white',
                        '&::placeholder': {
                          color: 'rgba(255, 255, 255, 0.7)',
                        }
                      },
                      '& .MuiInputLabel-root': {
                        color: 'rgba(255, 255, 255, 0.8)',
                        '&.Mui-focused': {
                          color: 'white',
                        }
                      },
                    }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Email sx={{ color: '#1877F2' }} />
                        </InputAdornment>
                      ),
                    }}
                  />

                  <TextField
                    {...register('password')}
                    fullWidth
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    variant="outlined"
                    margin="normal"
                    error={!!errors.password}
                    helperText={errors.password?.message}
                    className="glass-card"
                    sx={{
                      mb: 3,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '15px',
                        background: 'rgba(255, 255, 255, 0.2)',
                        backdropFilter: 'blur(15px)',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        fontSize: '16px',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&:hover': {
                          background: 'rgba(255, 255, 255, 0.25)',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 8px 32px rgba(102, 126, 234, 0.2)',
                        },
                        '&.Mui-focused': {
                          background: 'rgba(255, 255, 255, 0.3)',
                          boxShadow: '0 0 0 3px rgba(102, 126, 234, 0.3), 0 8px 32px rgba(102, 126, 234, 0.2)',
                          transform: 'translateY(-3px)',
                        },
                      },
                      '& .MuiOutlinedInput-input': {
                        py: 2,
                        px: 2,
                        color: 'white',
                        '&::placeholder': {
                          color: 'rgba(255, 255, 255, 0.7)',
                        }
                      },
                      '& .MuiInputLabel-root': {
                        color: 'rgba(255, 255, 255, 0.8)',
                        '&.Mui-focused': {
                          color: 'white',
                        }
                      },
                    }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock sx={{ color: '#1877F2' }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={handleTogglePassword} edge="end">
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />

                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    disabled={loading}
                    sx={{
                      py: 2,
                      fontSize: '18px',
                      fontWeight: 700,
                      borderRadius: 3,
                      background: 'linear-gradient(135deg, #ff6b6b, #ee5a24)',
                      boxShadow: '0 8px 24px rgba(255, 107, 107, 0.4)',
                      textTransform: 'none',
                      mb: 3,
                      '&:hover': {
                        background: 'linear-gradient(135deg, #ff4757, #ee5a24)',
                        boxShadow: '0 12px 32px rgba(255, 107, 107, 0.5)',
                        transform: 'translateY(-2px)',
                      },
                      '&:disabled': {
                        background: 'linear-gradient(135deg, #8A9BA8, #A0A9B8)',
                      },
                    }}
                    startIcon={
                      loading ? (
                        <CircularProgress size={20} sx={{ color: 'white' }} />
                      ) : (
                        <LoginIcon />
                      )
                    }
                  >
                    {loading ? 'Signing In...' : 'Log In'}
                  </Button>

                  <Divider sx={{ mb: 3 }}>
                    <Typography sx={{ color: '#65676B', fontSize: 14 }}>or continue with</Typography>
                  </Divider>

                  {/* OAuth Buttons */}
                  <Box sx={{ mb: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {/* Google OAuth */}
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={() => window.location.href = 'http://localhost:5001/api/auth/google'}
                      disabled={loading}
                      sx={{
                        py: 1.5,
                        fontSize: '16px',
                        fontWeight: 600,
                        borderRadius: 3,
                        borderColor: '#DB4437',
                        color: '#DB4437',
                        textTransform: 'none',
                        '&:hover': {
                          borderColor: '#C23321',
                          backgroundColor: 'rgba(219, 68, 55, 0.1)',
                        },
                      }}
                      startIcon={<Google />}
                    >
                      Continue with Google
                    </Button>

                    {/* Facebook OAuth */}
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={() => window.location.href = 'http://localhost:5001/api/auth/facebook'}
                      disabled={loading}
                      sx={{
                        py: 1.5,
                        fontSize: '16px',
                        fontWeight: 600,
                        borderRadius: 3,
                        borderColor: '#4267B2',
                        color: '#4267B2',
                        textTransform: 'none',
                        '&:hover': {
                          borderColor: '#365899',
                          backgroundColor: 'rgba(66, 103, 178, 0.1)',
                        },
                      }}
                      startIcon={<Facebook />}
                    >
                      Continue with Facebook
                    </Button>

                    {/* GitHub OAuth */}
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={() => window.location.href = 'http://localhost:5001/api/auth/github'}
                      disabled={loading}
                      sx={{
                        py: 1.5,
                        fontSize: '16px',
                        fontWeight: 600,
                        borderRadius: 3,
                        borderColor: '#333',
                        color: '#333',
                        textTransform: 'none',
                        '&:hover': {
                          borderColor: '#24292e',
                          backgroundColor: 'rgba(51, 51, 51, 0.1)',
                        },
                      }}
                      startIcon={<GitHub />}
                    >
                      Continue with GitHub
                    </Button>
                  </Box>

                  <Divider sx={{ mb: 3 }}>
                    <Typography sx={{ color: '#65676B', fontSize: 14 }}>or</Typography>
                  </Divider>

                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#65676B', mb: 2 }}>
                      Don't have an account?
                    </Typography>
                    
                    {/* Create Account Button */}
                    <Button
                      component={Link}
                      to="/register"
                      variant="outlined"
                      fullWidth
                      sx={{
                        py: 1.5,
                        fontSize: '16px',
                        fontWeight: 600,
                        borderRadius: 3,
                        borderColor: '#1877F2',
                        color: '#1877F2',
                        textTransform: 'none',
                        mb: 3,
                        '&:hover': {
                          borderColor: '#166FE5',
                          backgroundColor: 'rgba(24, 119, 242, 0.1)',
                          transform: 'translateY(-1px)',
                        },
                      }}
                    >
                      Create New Account
                    </Button>
                    
                    {/* Admin Panel Access */}
                    <Divider sx={{ my: 2 }}>
                      <Typography sx={{ color: '#65676B', fontSize: 12 }}>Admin Access</Typography>
                    </Divider>
                    
                    <Button
                      component={Link}
                      to="/admin"
                      variant="contained"
                      size="small"
                      sx={{
                        py: 1,
                        px: 3,
                        fontSize: '14px',
                        fontWeight: 600,
                        borderRadius: 25,
                        background: 'linear-gradient(135deg, #FF6B6B, #FF8E8E)',
                        boxShadow: '0 4px 15px rgba(255, 107, 107, 0.3)',
                        textTransform: 'none',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #FF5252, #FF6B6B)',
                          boxShadow: '0 6px 20px rgba(255, 107, 107, 0.4)',
                          transform: 'translateY(-2px) scale(1.02)',
                        },
                        '&:before': {
                          content: '"🛡️"',
                          marginRight: '8px',
                        }
                      }}
                    >
                      Admin Panel
                    </Button>
                    
                    <Typography variant="caption" sx={{ 
                      display: 'block',
                      color: '#999', 
                      mt: 1,
                      fontSize: '11px'
                    }}>
                      Admin credentials required
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default Login;
