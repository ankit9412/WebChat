export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private socket: any = null;
  private eventHandlers: { [key: string]: Function[] } = {};
  private targetUserId: string | null = null;
  private isInitiator: boolean = false;
  private currentUserId: string | null = null;
  private callType: 'audio' | 'video' = 'video';
  
  // WebRTC Configuration - Simplified and more reliable
  private rtcConfig = {
    iceServers: [
      // Primary Google STUN servers (most reliable)
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      // Backup STUN servers
      { urls: 'stun:stun.services.mozilla.com' },
      // Free TURN server for better connectivity (if needed)
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ],
    // Simplified configuration for better compatibility
    iceCandidatePoolSize: 5,
    bundlePolicy: 'max-bundle' as RTCBundlePolicy,
    rtcpMuxPolicy: 'require' as RTCRtcpMuxPolicy,
  };

  // Simplified video constraints for better compatibility
  private getVideoConstraints(isHD: boolean = false) {
    // Default to standard quality for better compatibility
    const baseConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 44100
      }
    };

    if (isHD) {
      return {
        ...baseConstraints,
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 30 },
          facingMode: 'user'
        }
      };
    } else {
      return {
        ...baseConstraints,
        video: {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 24, max: 30 },
          facingMode: 'user'
        }
      };
    }
  }

  constructor(socket: any, currentUserId?: string) {
    this.socket = socket;
    this.currentUserId = currentUserId || null;
    this.setupSocketListeners();
    console.log('🎆 WebRTC Service initialized for user:', this.currentUserId);
  }

  // Event handling methods
  on(event: string, handler: Function) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
  }

  off(event: string, handler?: Function) {
    if (!this.eventHandlers[event]) {
      return;
    }
    
    if (handler) {
      // Remove specific handler
      const index = this.eventHandlers[event].indexOf(handler);
      if (index > -1) {
        this.eventHandlers[event].splice(index, 1);
      }
    } else {
      // Remove all handlers for this event
      this.eventHandlers[event] = [];
    }
  }

  emit(event: string, ...args: any[]) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => handler(...args));
    }
  }

  private setupSocketListeners() {
    if (!this.socket) return;

    this.socket.on('webrtc-signal', (data: any) => {
      console.log('📡 WebRTC Signal:', data.type, 'from:', data.from);
      this.handleSignal(data);
    });

    console.log('🔌 Socket listeners set up for WebRTC');
  }

  // Start a call as the caller
  async startCall(targetUserId: string, callType: 'audio' | 'video' = 'video', isHD: boolean = true): Promise<MediaStream> {
    console.log(`🚀 Starting ${callType} call to:`, targetUserId, 'HD:', isHD);
    
    this.targetUserId = targetUserId;
    this.callType = callType;
    this.isInitiator = true;
    
    // Get user media with enhanced constraints
    const constraints = callType === 'video' 
      ? this.getVideoConstraints(isHD)
      : { video: false, audio: this.getVideoConstraints(isHD).audio };
    
    this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    
    console.log('🎥 Got local stream:', {
      video: this.localStream.getVideoTracks().length,
      audio: this.localStream.getAudioTracks().length
    });
    
    // Emit local stream immediately
    this.emit('localStream', this.localStream);
    
    // Create peer connection
    this.createPeerConnection();
    
    // Add local stream
    this.localStream.getTracks().forEach(track => {
      this.peerConnection!.addTrack(track, this.localStream!);
    });
    
    // Create and send offer
    const offer = await this.peerConnection!.createOffer();
    await this.peerConnection!.setLocalDescription(offer);
    
    this.socket.emit('webrtc-signal', {
      type: 'offer',
      offer: offer,
      to: targetUserId,
      from: this.currentUserId
    });
    
    console.log('📤 Offer sent to:', targetUserId);
    return this.localStream;
  }
  
  // Answer a call as the receiver
  async answerCall(callerId: string, callType: 'audio' | 'video' = 'video', isHD: boolean = true): Promise<MediaStream> {
    console.log(`✅ Answering ${callType} call from:`, callerId, 'HD:', isHD);
    
    this.targetUserId = callerId;
    this.callType = callType;
    this.isInitiator = false;
    
    // Get user media with enhanced constraints
    const constraints = callType === 'video' 
      ? this.getVideoConstraints(isHD)
      : { video: false, audio: this.getVideoConstraints(isHD).audio };
    
    this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    
    console.log('🎥 Got local stream for answer:', {
      video: this.localStream.getVideoTracks().length,
      audio: this.localStream.getAudioTracks().length
    });
    
    // Emit local stream immediately
    this.emit('localStream', this.localStream);
    
    // Create peer connection if not exists
    if (!this.peerConnection) {
      this.createPeerConnection();
    }
    
    // Add local stream
    this.localStream.getTracks().forEach(track => {
      this.peerConnection!.addTrack(track, this.localStream!);
    });
    
    return this.localStream;
  }
  
  // Create peer connection with enhanced configuration
  private createPeerConnection() {
    console.log('🔧 Creating peer connection with enhanced configuration');
    
    this.peerConnection = new RTCPeerConnection(this.rtcConfig);
    
    // Set preferred codecs for better quality
    this.setCodecPreferences();
    
    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      console.log('📹 Received remote stream:', {
        streamId: event.streams[0].id,
        trackKind: event.track.kind,
        trackEnabled: event.track.enabled,
        trackReadyState: event.track.readyState
      });
      this.remoteStream = event.streams[0];
      this.emit('remoteStream', this.remoteStream);
    };
    
    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧯 Sending ICE candidate:', event.candidate.type);
        this.socket.emit('webrtc-signal', {
          type: 'ice-candidate',
          candidate: event.candidate,
          to: this.targetUserId,
          from: this.currentUserId
        });
      } else {
        console.log('✅ ICE gathering completed');
      }
    };
    
    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection!.connectionState;
      console.log('🔄 Connection state:', state);
      this.emit('connectionStateChange', state);
      
      if (state === 'connected') {
        console.log('✅ WebRTC connection established successfully');
        this.logConnectionStats();
      } else if (state === 'disconnected' || state === 'failed') {
        console.log('⚠️ WebRTC connection issues, state:', state);
      }
    };
    
    // Handle ICE connection state
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('🧯 ICE connection state:', this.peerConnection!.iceConnectionState);
    };
    
    // Handle signaling state changes
    this.peerConnection.onsignalingstatechange = () => {
      console.log('📡 Signaling state:', this.peerConnection!.signalingState);
    };
  }
  
  // Set codec preferences for better audio/video quality
  private setCodecPreferences() {
    if (!this.peerConnection) return;
    
    try {
      // Get transceivers
      const transceivers = this.peerConnection.getTransceivers();
      
      transceivers.forEach(transceiver => {
        const { kind } = transceiver.receiver.track || { kind: transceiver.sender.track?.kind };
        
        if (kind === 'video') {
          // Prefer H.264 and VP9 for video
          const videoCodecs = RTCRtpReceiver.getCapabilities('video')?.codecs || [];
          const preferredVideoCodecs = videoCodecs.filter(codec => 
            codec.mimeType.includes('H264') || 
            codec.mimeType.includes('VP9') ||
            codec.mimeType.includes('VP8')
          ).sort((a, b) => {
            if (a.mimeType.includes('H264')) return -1;
            if (b.mimeType.includes('H264')) return 1;
            if (a.mimeType.includes('VP9')) return -1;
            if (b.mimeType.includes('VP9')) return 1;
            return 0;
          });
          
          if (preferredVideoCodecs.length > 0) {
            transceiver.setCodecPreferences(preferredVideoCodecs);
            console.log('🎥 Video codec preferences set:', preferredVideoCodecs.map(c => c.mimeType));
          }
        } else if (kind === 'audio') {
          // Prefer Opus for audio
          const audioCodecs = RTCRtpReceiver.getCapabilities('audio')?.codecs || [];
          const preferredAudioCodecs = audioCodecs.filter(codec => 
            codec.mimeType.includes('opus') ||
            codec.mimeType.includes('PCMU') ||
            codec.mimeType.includes('PCMA')
          ).sort((a, b) => {
            if (a.mimeType.includes('opus')) return -1;
            if (b.mimeType.includes('opus')) return 1;
            return 0;
          });
          
          if (preferredAudioCodecs.length > 0) {
            transceiver.setCodecPreferences(preferredAudioCodecs);
            console.log('🎧 Audio codec preferences set:', preferredAudioCodecs.map(c => c.mimeType));
          }
        }
      });
    } catch (error) {
      console.warn('⚠️ Could not set codec preferences:', error);
    }
  }
  
  // Log connection statistics for debugging
  private async logConnectionStats() {
    if (!this.peerConnection) return;
    
    try {
      const stats = await this.peerConnection.getStats();
      let videoStats = null;
      let audioStats = null;
      
      stats.forEach(report => {
        if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
          videoStats = {
            bytesReceived: report.bytesReceived,
            framesReceived: report.framesReceived,
            frameWidth: report.frameWidth,
            frameHeight: report.frameHeight,
            framesPerSecond: report.framesPerSecond
          };
        } else if (report.type === 'inbound-rtp' && report.mediaType === 'audio') {
          audioStats = {
            bytesReceived: report.bytesReceived,
            packetsReceived: report.packetsReceived,
            audioLevel: report.audioLevel
          };
        }
      });
      
      if (videoStats || audioStats) {
        console.log('📊 Connection stats:', { video: videoStats, audio: audioStats });
      }
    } catch (error) {
      console.warn('⚠️ Could not get connection stats:', error);
    }
  }
  
  // Handle WebRTC signals
  private async handleSignal(data: any) {
    console.log('📡 Handling signal:', data.type, 'from:', data.from);
    
    try {
      switch (data.type) {
        case 'offer':
          await this.handleOffer(data);
          break;
        case 'answer':
          await this.handleAnswer(data);
          break;
        case 'ice-candidate':
          await this.handleIceCandidate(data);
          break;
      }
    } catch (error) {
      console.error('❌ Error handling signal:', error);
    }
  }
  
  // Handle incoming offer
  private async handleOffer(data: any) {
    console.log('📞 Handling offer from:', data.from);
    
    if (this.isInitiator) {
      console.log('⚠️ Ignoring offer - we are the initiator');
      return;
    }
    
    this.targetUserId = data.from;
    
    if (!this.peerConnection) {
      this.createPeerConnection();
    }
    
    // Set remote description
    await this.peerConnection!.setRemoteDescription(data.offer);
    
    // Create answer
    const answer = await this.peerConnection!.createAnswer();
    await this.peerConnection!.setLocalDescription(answer);
    
    // Send answer
    this.socket.emit('webrtc-signal', {
      type: 'answer',
      answer: answer,
      to: data.from,
      from: this.currentUserId
    });
    
    console.log('📤 Answer sent to:', data.from);
  }
  
  // Handle incoming answer
  private async handleAnswer(data: any) {
    console.log('✅ Handling answer from:', data.from);
    
    if (!this.peerConnection) {
      console.error('❌ No peer connection for answer');
      return;
    }
    
    await this.peerConnection.setRemoteDescription(data.answer);
    console.log('✅ Remote description set from answer');
  }
  
  // Handle ICE candidate
  private async handleIceCandidate(data: any) {
    if (!this.peerConnection) {
      console.warn('⚠️ No peer connection for ICE candidate');
      return;
    }
    
    await this.peerConnection.addIceCandidate(data.candidate);
    console.log('🧊 ICE candidate added');
  }
  
  // End call and cleanup
  endCall() {
    console.log('📞 Ending call and cleaning up');
    
    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        console.log('💫 Stopped track:', track.kind);
      });
      this.localStream = null;
    }
    
    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    // Reset state
    this.remoteStream = null;
    this.targetUserId = null;
    this.isInitiator = false;
  }
  
  // Get local stream
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }
  
  // Get remote stream
  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }
  
  // Toggle mute
  toggleMute(): boolean {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return !audioTrack.enabled;
      }
    }
    return false;
  }
  
  // Toggle video
  toggleVideo(): boolean {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return !videoTrack.enabled;
      }
    }
    return false;
  }
}



