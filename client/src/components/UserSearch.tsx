import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Button,
  Box,
  Typography,
  InputAdornment,
} from '@mui/material';
import { Search, PersonAdd } from '@mui/icons-material';
import { userAPI } from '../services/api';

interface User {
  _id: string;
  username: string;
  email: string;
  profilePicture?: string;
  status: string;
  lastSeen: string;
}

interface UserSearchProps {
  open: boolean;
  onClose: () => void;
  onUserSelect: (user: User) => void;
}

const UserSearch: React.FC<UserSearchProps> = ({ open, onClose, onUserSelect }) => {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  const searchUsers = async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setUsers([]);
      return;
    }

    setLoading(true);
    try {
      const response = await userAPI.searchUsers(searchQuery);
      setUsers(response.data as User[]);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => searchUsers(query), 300);
    return () => clearTimeout(timeoutId);
  }, [query]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Search Users</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          placeholder="Search by username or email..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />
        
        {loading && <Typography>Searching...</Typography>}
        
        <List>
          {users.map((user) => (
            <ListItem
              key={user._id}
              component="div"
              onClick={() => {
                onUserSelect(user);
                onClose();
              }}
              sx={{ 
                cursor: 'pointer',
                '&:hover': { backgroundColor: 'action.hover' }
              }}
            >
              <ListItemAvatar>
                <Avatar src={user.profilePicture}>
                  {user.username.charAt(0).toUpperCase()}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={user.username}
                secondary={user.email}
              />
              <Button
                variant="outlined"
                size="small"
                startIcon={<PersonAdd />}
              >
                Add
              </Button>
            </ListItem>
          ))}
        </List>
      </DialogContent>
    </Dialog>
  );
};

export default UserSearch;
