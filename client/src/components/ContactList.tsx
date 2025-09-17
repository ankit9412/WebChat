import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  IconButton,
  TextField,
  InputAdornment,
  Fab,
  Box,
  Typography,
  Chip,
  Menu,
  MenuItem,
  Badge
} from '@mui/material';
import {
  VideoCall as VideoCallIcon,
  Call as CallIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  MoreVert as MoreVertIcon,
  Phone as PhoneIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';

interface User {
  _id: string;
  username: string;
  email: string;
  profilePicture?: string;
  isOnline?: boolean;
  lastSeen?: Date;
}

interface ContactListProps {
  open: boolean;
  onClose: () => void;
  onStartCall: (user: User, type: 'audio' | 'video') => void;
  users: User[];
}

const ContactList: React.FC<ContactListProps> = ({
  open,
  onClose,
  onStartCall,
  users = []
}) => {
  const { user: currentUser } = useAuth();
  const { socket } = useSocket();
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      // Filter out current user and sort by online status
      const otherUsers = users
        .filter(user => user._id !== currentUser?.id)
        .sort((a, b) => {
          // Online users first
          if (a.isOnline && !b.isOnline) return -1;
          if (!a.isOnline && b.isOnline) return 1;
          // Then alphabetically
          return a.username.localeCompare(b.username);
        });
      setFilteredUsers(otherUsers);
    } else {
      const filtered = users
        .filter(user => 
          user._id !== currentUser?.id &&
          (user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
           user.email.toLowerCase().includes(searchQuery.toLowerCase()))
        )
        .sort((a, b) => a.username.localeCompare(b.username));
      setFilteredUsers(filtered);
    }
  }, [users, searchQuery, currentUser]);

  const handleCallClick = (user: User, type: 'audio' | 'video') => {
    console.log(`Starting ${type} call to:`, user.username);
    onStartCall(user, type);
    onClose();
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, user: User) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedUser(user);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedUser(null);
  };

  const formatLastSeen = (lastSeen?: Date) => {
    if (!lastSeen) return 'Unknown';
    
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffMs = now.getTime() - lastSeenDate.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return lastSeenDate.toLocaleDateString();
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            height: '80vh',
            bgcolor: 'background.paper'
          }
        }}
      >
        <DialogTitle 
          sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            pb: 1
          }}
        >
          <Typography variant="h6" fontWeight="bold">
            Select Contact
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        <DialogContent sx={{ p: 0 }}>
          {/* Search Field */}
          <Box sx={{ p: 2, pb: 1 }}>
            <TextField
              fullWidth
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
                sx: {
                  borderRadius: 20,
                  bgcolor: 'background.default'
                }
              }}
              variant="outlined"
              size="small"
            />
          </Box>

          {/* Contacts List */}
          <List sx={{ pt: 0 }}>
            {filteredUsers.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="text.secondary">
                  {searchQuery ? 'No contacts found' : 'No contacts available'}
                </Typography>
              </Box>
            ) : (
              filteredUsers.map((user) => (
                <ListItem
                  key={user._id}
                  sx={{
                    py: 1.5,
                    px: 2,
                    '&:hover': {
                      bgcolor: 'action.hover'
                    },
                    cursor: 'pointer',
                    borderBottom: '1px solid',
                    borderBottomColor: 'divider'
                  }}
                >
                  <ListItemAvatar>
                    <Badge
                      overlap="circular"
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                      variant="dot"
                      color={user.isOnline ? 'success' : 'default'}
                      sx={{
                        '& .MuiBadge-dot': {
                          bgcolor: user.isOnline ? '#4caf50' : '#bdbdbd',
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          border: '2px solid white'
                        }
                      }}
                    >
                      <Avatar
                        src={user.profilePicture}
                        sx={{ width: 56, height: 56 }}
                      >
                        {user.username.charAt(0).toUpperCase()}
                      </Avatar>
                    </Badge>
                  </ListItemAvatar>
                  
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1" fontWeight="medium">
                          {user.username}
                        </Typography>
                        {user.isOnline && (
                          <Chip
                            label="Online"
                            size="small"
                            color="success"
                            sx={{ 
                              height: 20, 
                              fontSize: '0.75rem',
                              fontWeight: 'medium'
                            }}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Typography variant="body2" color="text.secondary">
                        {user.isOnline ? 'Online' : `Last seen ${formatLastSeen(user.lastSeen)}`}
                      </Typography>
                    }
                  />
                  
                  {/* Call Action Buttons */}
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton
                      onClick={() => handleCallClick(user, 'audio')}
                      color="primary"
                      sx={{
                        bgcolor: 'primary.light',
                        color: 'primary.contrastText',
                        '&:hover': {
                          bgcolor: 'primary.main'
                        }
                      }}
                    >
                      <CallIcon />
                    </IconButton>
                    
                    <IconButton
                      onClick={() => handleCallClick(user, 'video')}
                      color="success"
                      sx={{
                        bgcolor: 'success.light',
                        color: 'success.contrastText',
                        '&:hover': {
                          bgcolor: 'success.main'
                        }
                      }}
                    >
                      <VideoCallIcon />
                    </IconButton>
                    
                    <IconButton
                      onClick={(e) => handleMenuOpen(e, user)}
                      size="small"
                      color="inherit"
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Box>
                </ListItem>
              ))
            )}
          </List>
        </DialogContent>
      </Dialog>

      {/* Contact Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={() => {
          if (selectedUser) {
            handleCallClick(selectedUser, 'audio');
          }
          handleMenuClose();
        }}>
          <CallIcon sx={{ mr: 2 }} />
          Audio Call
        </MenuItem>
        <MenuItem onClick={() => {
          if (selectedUser) {
            handleCallClick(selectedUser, 'video');
          }
          handleMenuClose();
        }}>
          <VideoCallIcon sx={{ mr: 2 }} />
          Video Call
        </MenuItem>
      </Menu>
    </>
  );
};

// Floating Action Button for quick access
export const CallFab: React.FC<{
  onClick: () => void;
  type?: 'video' | 'audio';
}> = ({ onClick, type = 'video' }) => {
  return (
    <Fab
      color={type === 'video' ? 'success' : 'primary'}
      aria-label={type === 'video' ? 'video call' : 'audio call'}
      onClick={onClick}
      sx={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 1000,
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        '&:hover': {
          transform: 'scale(1.1)'
        },
        transition: 'transform 0.2s ease'
      }}
    >
      {type === 'video' ? <VideoCallIcon /> : <PhoneIcon />}
    </Fab>
  );
};

export default ContactList;