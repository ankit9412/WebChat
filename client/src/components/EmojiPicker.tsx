import React from 'react';
import { Box, Paper, IconButton, Typography } from '@mui/material';
import { Close } from '@mui/icons-material';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
}

const emojis = ['😀', '😂', '😍', '🥰', '😘', '😊', '😉', '😎', '🤔', '😮', '😢', '😡', '👍', '👎', '❤️', '🎉', '🔥', '💯'];

const EmojiPicker: React.FC<EmojiPickerProps> = ({ onEmojiSelect, onClose }) => {
  return (
    <Paper elevation={3} className="emoji-picker">
      <Box sx={{ p: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="subtitle2">Emojis</Typography>
        <IconButton size="small" onClick={onClose}>
          <Close />
        </IconButton>
      </Box>
      <Box sx={{ p: 1, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 0.5 }}>
        {emojis.map((emoji) => (
          <IconButton
            key={emoji}
            onClick={() => onEmojiSelect(emoji)}
            sx={{ fontSize: '1.5rem' }}
          >
            {emoji}
          </IconButton>
        ))}
      </Box>
    </Paper>
  );
};

export default EmojiPicker;
