import { supabase } from './supabase';

export interface PeerConnection {
  peerId: string;
  peer: RTCPeerConnection;
  stream?: MediaStream;
  name: string;
  dataChannel?: RTCDataChannel;
}

export class WebRTCManager {
  private localStream: MediaStream | null = null;
  private peers: Map<string, PeerConnection> = new Map();
  private meetingId: string;
  private participantId: string;
  private participantName: string;
  private onStreamCallback?: (peerId: string, stream: MediaStream, name: string) => void;
  private onPeerLeftCallback?: (peerId: string) => void;
  private onHandRaisedCallback?: (participantId: string, name: string, raised: boolean) => void;
  private signalingChannel: any;
  private isInitialized = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  // Enhanced ICE servers for better connectivity
  private iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.services.mozilla.com' },
    { urls: 'stun:stun.stunprotocol.org:3478' },
    // Additional TURN servers for better connectivity
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ];

  constructor(meetingId: string, participantId: string, participantName: string) {
    this.meetingId = meetingId;
    this.participantId = participantId;
    this.participantName = participantName;
    this.setupSignaling();
    this.startHeartbeat();
  }

  private setupSignaling() {
    this.signalingChannel = supabase
      .channel(`webrtc-${this.meetingId}`, {
        config: {
          broadcast: { self: false },
          presence: { key: this.participantId }
        }
      })
      .on('broadcast', { event: 'offer' }, (payload) => {
        this.handleOffer(payload.payload);
      })
      .on('broadcast', { event: 'answer' }, (payload) => {
        this.handleAnswer(payload.payload);
      })
      .on('broadcast', { event: 'ice-candidate' }, (payload) => {
        this.handleIceCandidate(payload.payload);
      })
      .on('broadcast', { event: 'user-joined' }, (payload) => {
        this.handleUserJoined(payload.payload);
      })
      .on('broadcast', { event: 'user-left' }, (payload) => {
        this.handleUserLeft(payload.payload);
      })
      .on('broadcast', { event: 'hand-raised' }, (payload) => {
        this.handleHandRaised(payload.payload);
      })
      .on('broadcast', { event: 'heartbeat' }, (payload) => {
        this.handleHeartbeat(payload.payload);
      })
      .on('presence', { event: 'sync' }, () => {
        this.handlePresenceSync();
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        this.handlePresenceJoin(key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        this.handlePresenceLeave(key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Signaling channel connected');
          await this.announcePresence();
        }
      });
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.signalingChannel?.send({
        type: 'broadcast',
        event: 'heartbeat',
        payload: {
          participantId: this.participantId,
          timestamp: Date.now()
        }
      });
    }, 10000); // Send heartbeat every 10 seconds
  }

  private handleHeartbeat(data: { participantId: string; timestamp: number }) {
    // Update peer connection health
    const peer = this.peers.get(data.participantId);
    if (peer) {
      // Peer is alive, reset any reconnection attempts
      this.reconnectAttempts = 0;
    }
  }

  private async announcePresence() {
    await this.signalingChannel.track({
      participantId: this.participantId,
      name: this.participantName,
      joinedAt: Date.now()
    });
  }

  private handlePresenceSync() {
    const state = this.signalingChannel.presenceState();
    Object.keys(state).forEach(key => {
      if (key !== this.participantId && !this.peers.has(key)) {
        const presence = state[key][0];
        this.handleUserJoined({
          participantId: key,
          name: presence.name
        });
      }
    });
  }

  private handlePresenceJoin(key: string, newPresences: any[]) {
    if (key !== this.participantId && newPresences.length > 0) {
      const presence = newPresences[0];
      this.handleUserJoined({
        participantId: key,
        name: presence.name
      });
    }
  }

  private handlePresenceLeave(key: string, leftPresences: any[]) {
    if (key !== this.participantId) {
      this.handleUserLeft({ participantId: key });
    }
  }

  async initializeMedia(video: boolean = true, audio: boolean = true): Promise<MediaStream> {
    try {
      // Ultra-high quality media constraints
      const constraints: MediaStreamConstraints = {
        video: video ? {
          width: { min: 320, ideal: 1920, max: 3840 },
          height: { min: 240, ideal: 1080, max: 2160 },
          frameRate: { min: 24, ideal: 60, max: 120 },
          facingMode: 'user',
          aspectRatio: 16/9,
          // Advanced video settings
          advanced: [
            { width: { min: 1920 } },
            { height: { min: 1080 } },
            { frameRate: { min: 60 } },
            { aspectRatio: { exact: 1.777777778 } }
          ]
        } : false,
        audio: audio ? {
          // Professional audio settings
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: { ideal: 48000, min: 44100 },
          channelCount: 2,
          sampleSize: 16,
          latency: { ideal: 0.01, max: 0.05 },
          // Chrome-specific advanced audio processing
          advanced: [
            { echoCancellation: { exact: true } },
            { noiseSuppression: { exact: true } },
            { autoGainControl: { exact: true } },
            { googEchoCancellation: { exact: true } },
            { googAutoGainControl: { exact: true } },
            { googNoiseSuppression: { exact: true } },
            { googHighpassFilter: { exact: true } },
            { googTypingNoiseDetection: { exact: true } },
            { googAudioMirroring: { exact: false } },
            { googDAEchoCancellation: { exact: true } },
            { googNoiseReduction: { exact: true } }
          ]
        } : false
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Apply professional audio processing
      if (audio && this.localStream.getAudioTracks().length > 0) {
        const audioTrack = this.localStream.getAudioTracks()[0];
        const audioContext = new AudioContext({
          sampleRate: 48000,
          latencyHint: 'interactive'
        });
        const source = audioContext.createMediaStreamSource(this.localStream);
        
        // Professional audio enhancement chain
        const gainNode = audioContext.createGain();
        const compressor = audioContext.createDynamicsCompressor();
        const filter = audioContext.createBiquadFilter();
        
        // Configure compressor for voice
        compressor.threshold.value = -24;
        compressor.knee.value = 30;
        compressor.ratio.value = 12;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;
        
        // Configure high-pass filter to remove low-frequency noise
        filter.type = 'highpass';
        filter.frequency.value = 85;
        filter.Q.value = 1;
        
        // Audio processing chain
        source.connect(gainNode);
        gainNode.connect(filter);
        filter.connect(compressor);
        
        const destination = audioContext.createMediaStreamDestination();
        compressor.connect(destination);
        
        // Set optimal gain
        gainNode.gain.value = 1.5;
      }

      return this.localStream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      // Fallback to lower quality if high quality fails
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          video: video ? { width: 640, height: 480 } : false,
          audio: audio ? { echoCancellation: true, noiseSuppression: true } : false
        });
        return this.localStream;
      } catch (fallbackError) {
        console.error('Fallback media access failed:', fallbackError);
        throw fallbackError;
      }
    }
  }

  async startScreenShare(): Promise<MediaStream> {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor',
          width: { ideal: 1920, max: 3840 },
          height: { ideal: 1080, max: 2160 },
          frameRate: { ideal: 60, max: 120 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
          channelCount: 2
        }
      });
      
      // Replace video track in all peer connections with better error handling
      const videoTrack = screenStream.getVideoTracks()[0];
      const promises = Array.from(this.peers.values()).map(async ({ peer }) => {
        try {
          const sender = peer.getSenders().find(s => 
            s.track && s.track.kind === 'video'
          );
          if (sender && videoTrack) {
            await sender.replaceTrack(videoTrack);
          }
        } catch (error) {
          console.error('Error replacing track for peer:', error);
        }
      });

      await Promise.all(promises);

      // Handle screen share end
      videoTrack.onended = async () => {
        if (this.localStream) {
          const videoTrack = this.localStream.getVideoTracks()[0];
          const promises = Array.from(this.peers.values()).map(async ({ peer }) => {
            try {
              const sender = peer.getSenders().find(s => 
                s.track && s.track.kind === 'video'
              );
              if (sender && videoTrack) {
                await sender.replaceTrack(videoTrack);
              }
            } catch (error) {
              console.error('Error restoring video track:', error);
            }
          });
          await Promise.all(promises);
        }
      };

      return screenStream;
    } catch (error) {
      console.error('Error starting screen share:', error);
      throw error;
    }
  }

  async joinMeeting() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Announce joining with enhanced signaling
    await this.signalingChannel.send({
      type: 'broadcast',
      event: 'user-joined',
      payload: { 
        participantId: this.participantId,
        name: this.participantName,
        timestamp: Date.now()
      }
    });

    // Also update presence
    await this.announcePresence();
  }

  private async handleUserJoined(data: { participantId: string; name: string }) {
    if (data.participantId === this.participantId) return;

    console.log('User joined:', data.name);
    
    // Small delay to ensure both sides are ready
    setTimeout(async () => {
      await this.createPeerConnection(data.participantId, data.name, true);
    }, 100);
  }

  private async createPeerConnection(peerId: string, name: string, isInitiator: boolean) {
    if (this.peers.has(peerId)) {
      console.log('Peer connection already exists for:', name);
      return;
    }

    const configuration: RTCConfiguration = {
      iceServers: this.iceServers,
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    };

    const peer = new RTCPeerConnection(configuration);

    // Create data channel for additional communication
    const dataChannel = peer.createDataChannel('messages', {
      ordered: true
    });

    // Add local stream tracks with enhanced settings
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        const sender = peer.addTrack(track, this.localStream!);
        
        // Configure encoding parameters for better quality
        if (track.kind === 'video') {
          const params = sender.getParameters();
          if (params.encodings && params.encodings.length > 0) {
            // Ultra-high quality video encoding
            params.encodings[0].maxBitrate = 8000000; // 8 Mbps for 4K quality
            params.encodings[0].maxFramerate = 60;
            params.encodings[0].scaleResolutionDownBy = 1;
            params.encodings[0].scalabilityMode = 'L1T3';
            sender.setParameters(params);
          }
        } else if (track.kind === 'audio') {
          const params = sender.getParameters();
          if (params.encodings && params.encodings.length > 0) {
            // High-fidelity audio encoding
            params.encodings[0].maxBitrate = 320000; // 320 kbps for studio quality
            params.encodings[0].priority = 'high';
            sender.setParameters(params);
          }
        }
      });
    }

    // Handle remote stream with immediate callback
    peer.ontrack = (event) => {
      console.log('Received remote stream from:', name);
      const [remoteStream] = event.streams;
      
      // Immediately notify about the stream
      setTimeout(() => {
        this.onStreamCallback?.(peerId, remoteStream, name);
      }, 0);
    };

    // Enhanced ICE candidate handling
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        this.signalingChannel.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: {
            from: this.participantId,
            to: peerId,
            candidate: event.candidate,
            timestamp: Date.now()
          }
        });
      }
    };

    // Handle connection state changes with reconnection logic
    peer.onconnectionstatechange = () => {
      console.log(`Connection state with ${name}:`, peer.connectionState);
      
      if (peer.connectionState === 'connected') {
        this.reconnectAttempts = 0;
        console.log(`Successfully connected to ${name}`);
      } else if (peer.connectionState === 'failed') {
        console.log(`Connection failed with ${name}, attempting reconnection...`);
        this.handleConnectionFailure(peerId, name);
      } else if (peer.connectionState === 'disconnected') {
        console.log(`Disconnected from ${name}`);
        setTimeout(() => {
          if (peer.connectionState === 'disconnected') {
            this.handleConnectionFailure(peerId, name);
          }
        }, 5000);
      }
    };

    // Handle ICE connection state
    peer.oniceconnectionstatechange = () => {
      console.log(`ICE connection state with ${name}:`, peer.iceConnectionState);
      
      if (peer.iceConnectionState === 'failed') {
        console.log(`ICE connection failed with ${name}, restarting ICE...`);
        peer.restartIce();
      }
    };

    this.peers.set(peerId, { peerId, peer, name, dataChannel });

    if (isInitiator) {
      try {
        // Create and send offer with enhanced options
        const offer = await peer.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
          iceRestart: false
        });
        
        await peer.setLocalDescription(offer);
        
        await this.signalingChannel.send({
          type: 'broadcast',
          event: 'offer',
          payload: {
            from: this.participantId,
            to: peerId,
            offer: offer,
            name: this.participantName,
            timestamp: Date.now()
          }
        });
      } catch (error) {
        console.error('Error creating offer:', error);
        this.peers.delete(peerId);
      }
    }
  }

  private async handleConnectionFailure(peerId: string, name: string) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log(`Max reconnection attempts reached for ${name}`);
      this.peers.delete(peerId);
      this.onPeerLeftCallback?.(peerId);
      return;
    }

    this.reconnectAttempts++;
    console.log(`Reconnection attempt ${this.reconnectAttempts} for ${name}`);

    // Clean up existing connection
    const existingPeer = this.peers.get(peerId);
    if (existingPeer) {
      existingPeer.peer.close();
      this.peers.delete(peerId);
    }

    // Wait before reconnecting
    setTimeout(async () => {
      try {
        await this.createPeerConnection(peerId, name, true);
      } catch (error) {
        console.error('Reconnection failed:', error);
      }
    }, 2000 * this.reconnectAttempts);
  }

  private async handleOffer(data: { from: string; to: string; offer: RTCSessionDescriptionInit; name: string; timestamp: number }) {
    if (data.to !== this.participantId) return;

    console.log('Received offer from:', data.name);
    
    // Clean up any existing connection
    const existingPeer = this.peers.get(data.from);
    if (existingPeer) {
      existingPeer.peer.close();
      this.peers.delete(data.from);
    }

    await this.createPeerConnection(data.from, data.name, false);
    
    const peerConnection = this.peers.get(data.from);
    if (peerConnection) {
      try {
        await peerConnection.peer.setRemoteDescription(data.offer);
        
        const answer = await peerConnection.peer.createAnswer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        
        await peerConnection.peer.setLocalDescription(answer);
        
        await this.signalingChannel.send({
          type: 'broadcast',
          event: 'answer',
          payload: {
            from: this.participantId,
            to: data.from,
            answer: answer,
            name: this.participantName,
            timestamp: Date.now()
          }
        });
      } catch (error) {
        console.error('Error handling offer:', error);
        this.peers.delete(data.from);
      }
    }
  }

  private async handleAnswer(data: { from: string; to: string; answer: RTCSessionDescriptionInit; name: string; timestamp: number }) {
    if (data.to !== this.participantId) return;

    console.log('Received answer from:', data.name);
    const peerConnection = this.peers.get(data.from);
    if (peerConnection) {
      try {
        await peerConnection.peer.setRemoteDescription(data.answer);
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    }
  }

  private async handleIceCandidate(data: { from: string; to: string; candidate: RTCIceCandidateInit; timestamp: number }) {
    if (data.to !== this.participantId) return;

    const peerConnection = this.peers.get(data.from);
    if (peerConnection && peerConnection.peer.remoteDescription) {
      try {
        await peerConnection.peer.addIceCandidate(data.candidate);
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    }
  }

  private async handleUserLeft(data: { participantId: string }) {
    console.log('User left:', data.participantId);
    const peerConnection = this.peers.get(data.participantId);
    if (peerConnection) {
      peerConnection.peer.close();
      this.peers.delete(data.participantId);
      this.onPeerLeftCallback?.(data.participantId);
    }
  }

  private handleHandRaised(data: { participantId: string; name: string; raised: boolean }) {
    if (data.participantId !== this.participantId) {
      this.onHandRaisedCallback?.(data.participantId, data.name, data.raised);
    }
  }

  onStream(callback: (peerId: string, stream: MediaStream, name: string) => void) {
    this.onStreamCallback = callback;
  }

  onPeerLeft(callback: (peerId: string) => void) {
    this.onPeerLeftCallback = callback;
  }

  toggleAudio(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  toggleVideo(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  async raiseHand(raised: boolean) {
    await this.signalingChannel.send({
      type: 'broadcast',
      event: 'hand-raised',
      payload: {
        participantId: this.participantId,
        name: this.participantName,
        raised: raised,
        timestamp: Date.now()
      }
    });
  }

  onHandRaised(callback: (participantId: string, name: string, raised: boolean) => void) {
    this.onHandRaisedCallback = callback;
  }

  async leaveMeeting() {
    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Announce leaving
    await this.signalingChannel.send({
      type: 'broadcast',
      event: 'user-left',
      payload: { 
        participantId: this.participantId,
        timestamp: Date.now()
      }
    });

    // Clean up peer connections
    this.peers.forEach(({ peer, dataChannel }) => {
      if (dataChannel) {
        dataChannel.close();
      }
      peer.close();
    });
    this.peers.clear();
    
    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }

    // Unsubscribe from signaling
    this.signalingChannel.unsubscribe();
  }

  // Get connection statistics for monitoring
  async getConnectionStats(): Promise<Map<string, RTCStatsReport>> {
    const stats = new Map<string, RTCStatsReport>();
    
    for (const [peerId, { peer }] of this.peers) {
      try {
        const report = await peer.getStats();
        stats.set(peerId, report);
      } catch (error) {
        console.error(`Error getting stats for peer ${peerId}:`, error);
      }
    }
    
    return stats;
  }
}