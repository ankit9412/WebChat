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
  Typography,
  Box,
  Chip,
  Divider,
  Badge,
  Tooltip
} from '@mui/material';
import {
  CallReceived as CallReceivedIcon,
  CallMade as CallMadeIcon,
  CallEnd as CallEndIcon,
  VideoCall as VideoCallIcon,
  Call as CallIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

interface CallRecord {
  id: string;
  type: 'audio' | 'video';
  direction: 'incoming' | 'outgoing';
  status: 'completed' | 'missed' | 'rejected' | 'cancelled';
  participant: {
    _id: string;
    username: string;
    profilePicture?: string;
  };
  startTime: Date;
  endTime?: Date;
  duration?: number; // in seconds
}

interface CallHistoryProps {
  open: boolean;
  onClose: () => void;
  onCallBack: (user: any, type: 'audio' | 'video') => void;
}

const CallHistory: React.FC<CallHistoryProps> = ({
  open,
  onClose,
  onCallBack
}) => {
  const { user: currentUser } = useAuth();
  const [callHistory, setCallHistory] = useState<CallRecord[]>([]);
  const [missedCallCount, setMissedCallCount] = useState(0);

  // Mock call history - replace with actual API call
  useEffect(() => {
    if (open) {
      const mockHistory: CallRecord[] = [
        {
          id: '1',
          type: 'video',
          direction: 'outgoing',
          status: 'completed',
          participant: {
            _id: '1',
            username: 'John Doe',
            profilePicture: undefined
          },
          startTime: new Date(Date.now() - 3600000), // 1 hour ago
          endTime: new Date(Date.now() - 3300000), // 55 minutes ago
          duration: 300 // 5 minutes
        },
        {
          id: '2',
          type: 'audio',
          direction: 'incoming',
          status: 'missed',
          participant: {
            _id: '2',
            username: 'Jane Smith'
          },
          startTime: new Date(Date.now() - 7200000) // 2 hours ago
        },
        {
          id: '3',
          type: 'video',
          direction: 'incoming',
          status: 'completed',
          participant: {
            _id: '3',
            username: 'Mike Johnson'
          },
          startTime: new Date(Date.now() - 86400000), // 1 day ago
          endTime: new Date(Date.now() - 86100000),
          duration: 180 // 3 minutes
        },
        {
          id: '4',
          type: 'audio',
          direction: 'outgoing',
          status: 'rejected',
          participant: {
            _id: '1',
            username: 'John Doe'
          },
          startTime: new Date(Date.now() - 172800000) // 2 days ago
        },
        {
          id: '5',
          type: 'video',
          direction: 'incoming',
          status: 'missed',
          participant: {
            _id: '4',
            username: 'Sarah Wilson'
          },
          startTime: new Date(Date.now() - 259200000) // 3 days ago
        }
      ];

      setCallHistory(mockHistory);
      setMissedCallCount(mockHistory.filter(call => call.status === 'missed').length);
    }
  }, [open]);

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCallIcon = (call: CallRecord) => {
    const iconProps = { 
      sx: { fontSize: 20 },
      color: call.status === 'missed' ? 'error' as const : 
             call.status === 'rejected' ? 'warning' as const : 
             'success' as const
    };

    if (call.direction === 'incoming') {
      return <CallReceivedIcon {...iconProps} />;
    } else {
      return <CallMadeIcon {...iconProps} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#4caf50';
      case 'missed': return '#f44336';
      case 'rejected': return '#ff9800';
      case 'cancelled': return '#9e9e9e';
      default: return '#9e9e9e';
    }
  };

  const handleCallBack = (call: CallRecord) => {
    onCallBack(call.participant, call.type);
    onClose();
  };

  const clearMissedCalls = () => {
    setCallHistory(prev => 
      prev.map(call => 
        call.status === 'missed' 
          ? { ...call, status: 'completed' as const }
          : call
      )
    );
    setMissedCallCount(0);
  };

  return (
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6" fontWeight="bold">
            Call History
          </Typography>
          {missedCallCount > 0 && (
            <Badge 
              badgeContent={missedCallCount} 
              color="error"
              sx={{
                '& .MuiBadge-badge': {
                  fontSize: '0.75rem',
                  height: 20,
                  minWidth: 20
                }
              }}
            >
              <Chip
                label="Missed"
                color="error"
                size="small"
                onClick={clearMissedCalls}
                sx={{ cursor: 'pointer' }}
              />
            </Badge>
          )}
        </Box>
        
        <Box>
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={() => window.location.reload()}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ p: 0 }}>
        <List sx={{ pt: 0 }}>
          {callHistory.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CallIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography color="text.secondary">
                No call history yet
              </Typography>
            </Box>
          ) : (
            callHistory.map((call, index) => (
              <React.Fragment key={call.id}>
                <ListItem
                  sx={{
                    py: 2,
                    px: 2,
                    '&:hover': {
                      bgcolor: 'action.hover'
                    },
                    cursor: 'pointer',
                    ...(call.status === 'missed' && {
                      bgcolor: 'rgba(255, 82, 82, 0.08)'
                    })
                  }}
                  onClick={() => handleCallBack(call)}
                >
                  <ListItemAvatar>
                    <Badge
                      overlap="circular"
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                      badgeContent={
                        <Box
                          sx={{
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            bgcolor: 'background.paper',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '2px solid white'
                          }}
                        >
                          {call.type === 'video' ? (
                            <VideoCallIcon sx={{ fontSize: 12, color: 'primary.main' }} />
                          ) : (
                            <CallIcon sx={{ fontSize: 12, color: 'primary.main' }} />
                          )}
                        </Box>
                      }
                    >
                      <Avatar
                        src={call.participant.profilePicture}
                        sx={{ width: 50, height: 50 }}
                      >
                        {call.participant.username.charAt(0).toUpperCase()}
                      </Avatar>
                    </Badge>
                  </ListItemAvatar>
                  
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1" fontWeight="medium">
                          {call.participant.username}
                        </Typography>
                        {getCallIcon(call)}
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Chip
                            label={call.status}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '0.7rem',
                              bgcolor: getStatusColor(call.status),
                              color: 'white',
                              fontWeight: 500
                            }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {call.type} call
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            {formatTime(call.startTime)}
                          </Typography>
                          {call.duration && (
                            <>
                              <Typography variant="caption" color="text.secondary">
                                •
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {formatDuration(call.duration)}
                              </Typography>
                            </>
                          )}
                        </Box>
                      </Box>
                    }
                  />
                  
                  {/* Call back button */}
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCallBack(call);
                    }}
                    color="primary"
                    sx={{
                      bgcolor: 'primary.light',
                      '&:hover': {
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText'
                      }
                    }}
                  >
                    {call.type === 'video' ? <VideoCallIcon /> : <CallIcon />}
                  </IconButton>
                </ListItem>
                
                {index < callHistory.length - 1 && <Divider />}
              </React.Fragment>
            ))
          )}
        </List>
      </DialogContent>
    </Dialog>
  );
};

export default CallHistory;