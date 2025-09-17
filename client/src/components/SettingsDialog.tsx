import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Avatar,
  TextField,
  Paper,
  IconButton,
  Chip,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  PhotoCamera,
  Person,
  Notifications,
  Security,
  Palette,
  Edit,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { userAPI } from '../services/api';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({ open, onClose }) => {
  const { user, updateUser } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [username, setUsername] = useState(user?.username || '');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Only image files are allowed');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const response = await userAPI.uploadAvatar(file);
      updateUser({ profilePicture: (response.data as any).profilePicture });
      setSuccess('Profile picture updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to upload profile picture');
    } finally {
      setUploading(false);
    }
  };

  const handleUsernameUpdate = async () => {
    if (!username.trim() || username === user?.username) return;

    try {
      const response = await userAPI.updateProfile({ username });
      updateUser(response.data as any);
      setSuccess('Username updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to update username');
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: 3,
          background: 'linear-gradient(to bottom, #ffffff, #f8fafc)',
        }
      }}
    >
      <DialogTitle sx={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        fontSize: '1.5rem',
        fontWeight: 600
      }}>
        Settings
      </DialogTitle>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab icon={<Person />} label="Profile" />
          <Tab icon={<Notifications />} label="Notifications" />
          <Tab icon={<Security />} label="Privacy" />
          <Tab icon={<Palette />} label="Appearance" />
        </Tabs>
      </Box>

      <DialogContent sx={{ minHeight: 400, p: 0 }}>
        {success && (
          <Alert severity="success" sx={{ m: 2, mb: 0 }}>
            {success}
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ m: 2, mb: 0 }}>
            {error}
          </Alert>
        )}

        {/* Profile Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ p: 3 }}>
            {/* Profile Picture Section */}
            <Paper elevation={1} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PhotoCamera color="primary" />
                Profile Picture
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <Box sx={{ position: 'relative' }}>
                  <Avatar
                    src={user?.profilePicture}
                    sx={{ 
                      width: 100, 
                      height: 100,
                      cursor: 'pointer',
                      border: '3px solid #667eea',
                      '&:hover': { opacity: 0.8 }
                    }}
                    onClick={handleAvatarClick}
                  >
                    {user?.username?.charAt(0).toUpperCase()}
                  </Avatar>
                  
                  {uploading && (
                    <Box sx={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                    }}>
                      <CircularProgress size={24} />
                    </Box>
                  )}
                  
                  <IconButton
                    sx={{
                      position: 'absolute',
                      bottom: -5,
                      right: -5,
                      bgcolor: '#667eea',
                      color: 'white',
                      width: 32,
                      height: 32,
                      '&:hover': { bgcolor: '#5a6fd8' }
                    }}
                    onClick={handleAvatarClick}
                    disabled={uploading}
                  >
                    <PhotoCamera fontSize="small" />
                  </IconButton>
                </Box>
                
                <Box>
                  <Typography variant="body1" gutterBottom>
                    Click on the avatar or camera icon to upload a new picture
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Supported formats: JPG, PNG, GIF (Max 5MB)
                  </Typography>
                </Box>
              </Box>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                style={{ display: 'none' }}
              />
            </Paper>

            {/* Username Section */}
            <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Edit color="primary" />
                Username
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <TextField
                  fullWidth
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  variant="outlined"
                  size="small"
                  sx={{ maxWidth: 300 }}
                />
                <Button
                  variant="contained"
                  onClick={handleUsernameUpdate}
                  disabled={!username.trim() || username === user?.username}
                  sx={{
                    background: 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #5a6fd8 30%, #6a4190 90%)',
                    }
                  }}
                >
                  Update
                </Button>
              </Box>
            </Paper>
          </Box>
        </TabPanel>

        {/* Notifications Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ p: 3 }}>
            <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="h6" gutterBottom>
                Notification Preferences
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Message notifications"
                />
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Call notifications"
                />
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Email notifications"
                />
                <FormControlLabel
                  control={<Switch />}
                  label="Desktop notifications"
                />
              </Box>
            </Paper>
          </Box>
        </TabPanel>

        {/* Privacy Tab */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ p: 3 }}>
            <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="h6" gutterBottom>
                Privacy Settings
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Show online status"
                />
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Show last seen"
                />
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Allow calls from everyone"
                />
              </Box>
            </Paper>
          </Box>
        </TabPanel>

        {/* Appearance Tab */}
        <TabPanel value={tabValue} index={3}>
          <Box sx={{ p: 3 }}>
            <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="h6" gutterBottom>
                Theme
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip label="Light" variant="outlined" clickable />
                <Chip label="Dark" variant="outlined" clickable />
                <Chip label="Auto" variant="filled" color="primary" clickable />
              </Box>
            </Paper>
          </Box>
        </TabPanel>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 1 }}>
        <Button onClick={onClose} size="large">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SettingsDialog;
