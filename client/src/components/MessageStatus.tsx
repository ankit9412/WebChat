import React from 'react';
import { Box, SvgIcon } from '@mui/material';
import { Check, DoneAll } from '@mui/icons-material';

interface MessageStatusProps {
  status: 'sent' | 'delivered' | 'read';
  isOwn: boolean;
}

// Custom double check icon for delivered/read states
const DoubleCheck: React.FC<{ color?: string }> = ({ color = 'currentColor' }) => (
  <SvgIcon 
    sx={{ 
      fontSize: '16px',
      color: color
    }}
  >
    <svg viewBox="0 0 24 24" fill="none">
      <path
        d="M18 6L8.5 15.5l-4.5-4.5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M22 6L12.5 15.5l-1.5-1.5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </SvgIcon>
);

const MessageStatus: React.FC<MessageStatusProps> = ({ status, isOwn }) => {
  if (!isOwn) return null; // Only show status for own messages

  const getStatusIcon = () => {
    switch (status) {
      case 'sent':
        return (
          <Check 
            sx={{ 
              fontSize: '16px',
              color: '#9ca3af', // Gray for sent
              transition: 'color 0.2s ease'
            }} 
          />
        );
      case 'delivered':
        return (
          <DoubleCheck color="#9ca3af" />
        );
      case 'read':
        return (
          <DoubleCheck color="#3b82f6" />
        );
      default:
        return null;
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        ml: 1,
        opacity: 0.8,
        transition: 'opacity 0.2s ease',
        '&:hover': {
          opacity: 1
        }
      }}
    >
      {getStatusIcon()}
    </Box>
  );
};

export default MessageStatus;