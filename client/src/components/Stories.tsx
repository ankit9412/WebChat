import React, { useState, useEffect } from 'react';
import {
  Box,
  Avatar,
  Typography,
  IconButton,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  LinearProgress,
  Fab,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  NavigateNext,
  NavigateBefore,
  Favorite,
  FavoriteBorder,
  Send,
  MoreHoriz,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

interface Story {
  _id: string;
  user: {
    _id: string;
    username: string;
    profilePicture?: string;
  };
  media: {
    type: 'image' | 'video';
    url: string;
  };
  content?: string;
  createdAt: string;
  expiresAt: string;
  views: string[];
  likes: string[];
}

interface StoryGroup {
  user: {
    _id: string;
    username: string;
    profilePicture?: string;
  };
  stories: Story[];
  hasUnviewed: boolean;
}

const Stories: React.FC = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [selectedStoryGroup, setSelectedStoryGroup] = useState<StoryGroup | null>(null);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [storyProgress, setStoryProgress] = useState(0);

  // Mock data - replace with real API calls
  useEffect(() => {
    const mockStoryGroups: StoryGroup[] = [
      {
        user: { _id: 'your-story', username: 'Your Story', profilePicture: user?.profilePicture },
        stories: [],
        hasUnviewed: false,
      },
      {
        user: { _id: 'user1', username: 'Alice', profilePicture: '/avatars/alice.jpg' },
        stories: [
          {
            _id: 'story1',
            user: { _id: 'user1', username: 'Alice', profilePicture: '/avatars/alice.jpg' },
            media: { type: 'image', url: 'https://picsum.photos/400/600?random=1' },
            content: 'Beautiful sunset today! 🌅',
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            expiresAt: new Date(Date.now() + 22 * 60 * 60 * 1000).toISOString(),
            views: [],
            likes: ['user2', 'user3'],
          },
        ],
        hasUnviewed: true,
      },
      {
        user: { _id: 'user2', username: 'Bob', profilePicture: '/avatars/bob.jpg' },
        stories: [
          {
            _id: 'story2',
            user: { _id: 'user2', username: 'Bob', profilePicture: '/avatars/bob.jpg' },
            media: { type: 'image', url: 'https://picsum.photos/400/600?random=2' },
            content: 'Coffee break ☕',
            createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
            expiresAt: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(),
            views: ['user1'],
            likes: [],
          },
          {
            _id: 'story3',
            user: { _id: 'user2', username: 'Bob', profilePicture: '/avatars/bob.jpg' },
            media: { type: 'image', url: 'https://picsum.photos/400/600?random=3' },
            content: 'Working from the beach 🏖️',
            createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
            expiresAt: new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString(),
            views: [],
            likes: ['user1'],
          },
        ],
        hasUnviewed: true,
      },
    ];
    setStoryGroups(mockStoryGroups);
  }, [user]);

  const handleStoryClick = (storyGroup: StoryGroup, index?: number) => {
    if (storyGroup.stories.length === 0) {
      // Handle "Add Story" click
      console.log('Add new story');
      return;
    }
    setSelectedStoryGroup(storyGroup);
    setCurrentStoryIndex(index || 0);
    setStoryProgress(0);
  };

  const handleCloseStory = () => {
    setSelectedStoryGroup(null);
    setCurrentStoryIndex(0);
    setStoryProgress(0);
  };

  const handleNextStory = () => {
    if (selectedStoryGroup && currentStoryIndex < selectedStoryGroup.stories.length - 1) {
      setCurrentStoryIndex(currentStoryIndex + 1);
      setStoryProgress(0);
    } else {
      // Move to next story group or close
      const currentGroupIndex = storyGroups.findIndex(
        group => group.user._id === selectedStoryGroup?.user._id
      );
      if (currentGroupIndex < storyGroups.length - 1) {
        const nextGroup = storyGroups[currentGroupIndex + 1];
        if (nextGroup.stories.length > 0) {
          handleStoryClick(nextGroup, 0);
        }
      } else {
        handleCloseStory();
      }
    }
  };

  const handlePrevStory = () => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(currentStoryIndex - 1);
      setStoryProgress(0);
    } else {
      // Move to previous story group
      const currentGroupIndex = storyGroups.findIndex(
        group => group.user._id === selectedStoryGroup?.user._id
      );
      if (currentGroupIndex > 0) {
        const prevGroup = storyGroups[currentGroupIndex - 1];
        if (prevGroup.stories.length > 0) {
          handleStoryClick(prevGroup, prevGroup.stories.length - 1);
        }
      }
    }
  };

  // Auto-progress story timer
  useEffect(() => {
    if (selectedStoryGroup) {
      const interval = setInterval(() => {
        setStoryProgress(prev => {
          if (prev >= 100) {
            handleNextStory();
            return 0;
          }
          return prev + 2; // 5 seconds per story
        });
      }, 100);

      return () => clearInterval(interval);
    }
  }, [selectedStoryGroup, currentStoryIndex]);

  return (
    <Box
      sx={{
        display: 'flex',
        overflowX: 'auto',
        pb: 1,
        px: 2,
        gap: 1,
        backgroundColor: 'background.paper',
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        '&::-webkit-scrollbar': {
          height: 4,
        },
        '&::-webkit-scrollbar-track': {
          background: alpha(theme.palette.grey[300], 0.5),
          borderRadius: 2,
        },
        '&::-webkit-scrollbar-thumb': {
          background: alpha(theme.palette.primary.main, 0.5),
          borderRadius: 2,
          '&:hover': {
            background: alpha(theme.palette.primary.main, 0.7),
          },
        },
      }}
    >
      {storyGroups.map((storyGroup, index) => (
        <Box
          key={storyGroup.user._id}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: 'pointer',
            minWidth: 70,
            py: 1,
          }}
          onClick={() => handleStoryClick(storyGroup)}
        >
          <Box
            sx={{
              position: 'relative',
              mb: 0.5,
            }}
          >
            <Avatar
              src={storyGroup.user.profilePicture}
              sx={{
                width: 56,
                height: 56,
                border: storyGroup.stories.length === 0
                  ? `2px solid ${theme.palette.grey[300]}`
                  : storyGroup.hasUnviewed
                  ? `3px solid ${theme.palette.primary.main}`
                  : `3px solid ${theme.palette.grey[400]}`,
                backgroundColor: storyGroup.stories.length === 0 ? 'grey.100' : undefined,
              }}
            >
              {storyGroup.user._id === 'your-story' && storyGroup.stories.length === 0 && (
                <AddIcon sx={{ color: 'grey.500' }} />
              )}
              {storyGroup.user.username.charAt(0).toUpperCase()}
            </Avatar>
            
            {storyGroup.user._id === 'your-story' && storyGroup.stories.length === 0 && (
              <Fab
                size="small"
                sx={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  width: 20,
                  height: 20,
                  minHeight: 20,
                  backgroundColor: theme.palette.primary.main,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  '&:hover': {
                    backgroundColor: theme.palette.primary.dark,
                  },
                }}
              >
                <AddIcon sx={{ fontSize: 12, color: 'white' }} />
              </Fab>
            )}
          </Box>
          
          <Typography
            variant="caption"
            sx={{
              textAlign: 'center',
              maxWidth: 70,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: 'text.secondary',
              fontSize: '11px',
            }}
          >
            {storyGroup.user._id === 'your-story' ? 'Your Story' : storyGroup.user.username}
          </Typography>
        </Box>
      ))}

      {/* Story Viewer Dialog */}
      <Dialog
        open={!!selectedStoryGroup && selectedStoryGroup.stories.length > 0}
        onClose={handleCloseStory}
        maxWidth={false}
        PaperProps={{
          sx: {
            backgroundColor: 'black',
            maxWidth: 'none',
            maxHeight: 'none',
            width: '100vw',
            height: '100vh',
            m: 0,
            borderRadius: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
          },
        }}
      >
        <DialogContent
          sx={{
            p: 0,
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
          }}
        >
          {selectedStoryGroup && selectedStoryGroup.stories[currentStoryIndex] && (
            <>
              {/* Progress bars */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  display: 'flex',
                  gap: 0.5,
                  p: 1,
                  zIndex: 2,
                }}
              >
                {selectedStoryGroup.stories.map((_, index) => (
                  <Box
                    key={index}
                    sx={{
                      flex: 1,
                      height: 2,
                      backgroundColor: alpha('white', 0.3),
                      borderRadius: 1,
                      overflow: 'hidden',
                    }}
                  >
                    <LinearProgress
                      variant="determinate"
                      value={
                        index < currentStoryIndex
                          ? 100
                          : index === currentStoryIndex
                          ? storyProgress
                          : 0
                      }
                      sx={{
                        height: '100%',
                        backgroundColor: 'transparent',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: 'white',
                        },
                      }}
                    />
                  </Box>
                ))}
              </Box>

              {/* Header */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: 2,
                  pt: 4,
                  background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 100%)',
                  zIndex: 2,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar
                    src={selectedStoryGroup.user.profilePicture}
                    sx={{ width: 32, height: 32 }}
                  >
                    {selectedStoryGroup.user.username.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 600 }}>
                      {selectedStoryGroup.user.username}
                    </Typography>
                    <Typography variant="caption" sx={{ color: alpha('white', 0.8) }}>
                      {new Date(selectedStoryGroup.stories[currentStoryIndex].createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Typography>
                  </Box>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <IconButton sx={{ color: 'white' }}>
                    <MoreHoriz />
                  </IconButton>
                  <IconButton onClick={handleCloseStory} sx={{ color: 'white' }}>
                    <CloseIcon />
                  </IconButton>
                </Box>
              </Box>

              {/* Story Media */}
              <Box
                sx={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const isLeftHalf = x < rect.width / 2;
                  
                  if (isLeftHalf) {
                    handlePrevStory();
                  } else {
                    handleNextStory();
                  }
                }}
              >
                <img
                  src={selectedStoryGroup.stories[currentStoryIndex].media.url}
                  alt="Story"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                  }}
                />

                {/* Navigation Areas (invisible) */}
                <Box
                  sx={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: '50%',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    pl: 2,
                    '&:hover .nav-icon': {
                      opacity: 1,
                    },
                  }}
                >
                  <NavigateBefore
                    className="nav-icon"
                    sx={{
                      color: 'white',
                      opacity: 0,
                      transition: 'opacity 0.3s',
                      fontSize: 40,
                    }}
                  />
                </Box>
                
                <Box
                  sx={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: '50%',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    pr: 2,
                    '&:hover .nav-icon': {
                      opacity: 1,
                    },
                  }}
                >
                  <NavigateNext
                    className="nav-icon"
                    sx={{
                      color: 'white',
                      opacity: 0,
                      transition: 'opacity 0.3s',
                      fontSize: 40,
                    }}
                  />
                </Box>
              </Box>

              {/* Story Content */}
              {selectedStoryGroup.stories[currentStoryIndex].content && (
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 100,
                    left: 20,
                    right: 20,
                    textAlign: 'center',
                    zIndex: 2,
                  }}
                >
                  <Typography
                    variant="body1"
                    sx={{
                      color: 'white',
                      textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                      fontWeight: 500,
                    }}
                  >
                    {selectedStoryGroup.stories[currentStoryIndex].content}
                  </Typography>
                </Box>
              )}

              {/* Bottom Actions */}
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  p: 2,
                  background: 'linear-gradient(0deg, rgba(0,0,0,0.5) 0%, transparent 100%)',
                  zIndex: 2,
                }}
              >
                <IconButton sx={{ color: 'white' }}>
                  <FavoriteBorder />
                </IconButton>
                <Box
                  sx={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: alpha('white', 0.1),
                    borderRadius: 20,
                    px: 2,
                    py: 1,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ color: alpha('white', 0.8), flex: 1 }}
                  >
                    Send message...
                  </Typography>
                  <IconButton size="small" sx={{ color: 'white' }}>
                    <Send />
                  </IconButton>
                </Box>
              </Box>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default Stories;