import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
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
} from '@mui/material';
import { Lock, Visibility, VisibilityOff } from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { authAPI } from '../services/api';

const schema = yup.object({
  password: yup
    .string()
    .min(6, 'Password must be at least 6 characters')
    .required('Password is required'),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('password')], 'Passwords must match')
    .required('Please confirm your password'),
});

type FormData = yup.InferType<typeof schema>;

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: yupResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    const token = searchParams.get('token');
    
    if (!token) {
      setError('No reset token provided');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await authAPI.resetPassword(token, data.password);
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

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
              Password reset successfully! You can now sign in with your new password.
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
          </Paper>
        </Box>
      </Container>
    );
  }

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
          <Typography component="h1" variant="h4" color="primary" gutterBottom>
            Reset Password
          </Typography>

          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
            Enter your new password below
          </Typography>

          {error && (
            <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ width: '100%' }}>
            <TextField
              {...register('password')}
              margin="normal"
              required
              fullWidth
              name="password"
              label="New Password"
              type={showPassword ? 'text' : 'password'}
              id="password"
              autoComplete="new-password"
              autoFocus
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
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              {...register('confirmPassword')}
              margin="normal"
              required
              fullWidth
              name="confirmPassword"
              label="Confirm New Password"
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
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
              sx={{ mt: 3, mb: 2, py: 1.5 }}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : <Lock />}
            >
              {loading ? 'Resetting Password...' : 'Reset Password'}
            </Button>

            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Link to="/login" style={{ textDecoration: 'none' }}>
                <Typography variant="body2" color="primary">
                  Back to Sign In
                </Typography>
              </Link>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default ResetPassword;
