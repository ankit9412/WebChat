import React, { useCallback, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Chip,
} from '@mui/material';
import {
  CloudUpload,
  InsertDriveFile,
  Image,
  VideoFile,
  AudioFile,
  Close,
  Send,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { messageAPI } from '../services/api';

interface FileUploadProps {
  open: boolean;
  onClose: () => void;
  onFileSelect: (file: File) => void;
  receiverId: string;
}

interface FileWithPreview extends File {
  preview?: string;
  id: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ open, onClose, onFileSelect, receiverId }) => {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Debug props on component render
  React.useEffect(() => {
    console.log('🔍 FileUpload component props:', {
      open,
      receiverId,
      receiverIdType: typeof receiverId,
      receiverIdEmpty: !receiverId,
      receiverIdLength: receiverId?.length
    });
  }, [open, receiverId]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const filesWithPreview = acceptedFiles.map(file => ({
      ...file,
      id: Math.random().toString(36).substr(2, 9),
      preview: file.type && file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));
    setFiles(prev => [...prev, ...filesWithPreview]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif'],
      'video/*': ['.mp4', '.avi', '.mov'],
      'audio/*': ['.mp3', '.wav', '.ogg'],
      'application/pdf': ['.pdf'],
      'text/*': ['.txt', '.doc', '.docx'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const removeFile = (fileId: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === fileId);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter(f => f.id !== fileId);
    });
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      console.warn('⚠️ No files selected for upload');
      return;
    }
    
    // Validate receiverId
    if (!receiverId || receiverId.trim() === '') {
      console.error('❌ receiverId is missing or empty:', receiverId);
      alert('Error: Receiver ID is missing. Please try again.');
      return;
    }
    
    console.log('📤 Starting file upload...', {
      fileCount: files.length,
      receiverId,
      receiverIdValid: !!receiverId,
      files: files.map(f => ({ name: f.name, size: f.size, type: f.type }))
    });

    setUploading(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileType = (file.type && file.type.startsWith('image/')) ? 'image' : 'file';
        
        console.log(`📤 Uploading file ${i + 1}/${files.length}:`, {
          name: file.name,
          size: file.size,
          type: file.type,
          detectedType: fileType
        });
        
        // Log API call parameters
        console.log('🚀 API Call Parameters:', {
          receiverId,
          file: {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified
          },
          fileType,
          apiFunction: 'messageAPI.sendFile'
        });

        const response = await messageAPI.sendFile(
          receiverId,
          file,
          fileType
        );
        
        console.log('✅ File uploaded successfully:', (response as any)?.data || 'Upload completed');
        
        // Update progress
        const progress = Math.round(((i + 1) / files.length) * 100);
        setUploadProgress(progress);
        
        // Notify parent component
        onFileSelect(file);
      }

      console.log('✅ All files uploaded successfully');
      setFiles([]);
      onClose();
      
      // Show success message
      alert(`Successfully uploaded ${files.length} file${files.length !== 1 ? 's' : ''}!`);
      
    } catch (error: any) {
      console.error('❌ File upload error:', error);
      
      let errorMessage = 'Failed to upload files.';
      if (error.response) {
        errorMessage += ` Server error: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`;
      } else if (error.message) {
        errorMessage += ` ${error.message}`;
      }
      
      alert(errorMessage);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const getFileIcon = (file: File) => {
    if (!file.type) return <InsertDriveFile />;
    if (file.type.startsWith('image/')) return <Image />;
    if (file.type.startsWith('video/')) return <VideoFile />;
    if (file.type.startsWith('audio/')) return <AudioFile />;
    return <InsertDriveFile />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleClose = () => {
    // Clean up preview URLs
    files.forEach(file => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });
    setFiles([]);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Upload Files</DialogTitle>
      <DialogContent>
        <Box
          {...getRootProps()}
          sx={{
            border: '2px dashed',
            borderColor: isDragActive ? 'primary.main' : 'grey.300',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            cursor: 'pointer',
            bgcolor: isDragActive ? 'action.hover' : 'background.paper',
            transition: 'all 0.2s',
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: 'action.hover',
            },
          }}
        >
          <input {...getInputProps()} />
          <CloudUpload sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            or click to select files
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            Supports images, videos, audio, and documents (max 10MB each)
          </Typography>
        </Box>

        {files.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Selected Files ({files.length})
            </Typography>
            <List dense>
              {files.map((file) => (
                <ListItem
                  key={file.id}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1,
                  }}
                >
                  <ListItemIcon>
                    {file.preview ? (
                      <img
                        src={file.preview}
                        alt={file.name}
                        style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }}
                      />
                    ) : (
                      getFileIcon(file)
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={file.name}
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption">
                          {formatFileSize(file.size)}
                        </Typography>
                        <Chip
                          label={file.type ? file.type.split('/')[0] : 'file'}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      </Box>
                    }
                  />
                  <IconButton
                    size="small"
                    onClick={() => removeFile(file.id)}
                    color="error"
                  >
                    <Close />
                  </IconButton>
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {uploading && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" gutterBottom>
              Uploading... {uploadProgress}%
            </Typography>
            <LinearProgress variant="determinate" value={uploadProgress} />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={uploading}>
          Cancel
        </Button>
        <Button
          onClick={handleUpload}
          variant="contained"
          disabled={files.length === 0 || uploading}
          startIcon={<Send />}
        >
          {uploading ? 'Uploading...' : `Send ${files.length} file${files.length !== 1 ? 's' : ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FileUpload;
