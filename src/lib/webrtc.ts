import Peer from 'simple-peer';
import { supabase } from './supabase';

export interface PeerConnection {
  peerId: string;
  peer: Peer.Instance;
  stream?: MediaStream;
}

export class WebRTCManager {
  private localStream: MediaStream | null = null;
  private peers: Map<string, PeerConnection> = new Map();
  private meetingId: string;
  private participantId: string;
  private onStreamCallback?: (peerId: string, stream: MediaStream) => void;
  private onPeerLeftCallback?: (peerId: string) => void;
  private signalingChannel: any;

  constructor(meetingId: string, participantId: string) {
    this.meetingId = meetingId;
    this.participantId = participantId;
    this.setupSignaling();
  }

  private setupSignaling() {
    // Subscribe to signaling messages
    this.signalingChannel = supabase
      .channel(`webrtc-${this.meetingId}`)
      .on('broadcast', { event: 'signal' }, (payload) => {
        this.handleSignal(payload.payload);
      })
      .on('broadcast', { event: 'user-joined' }, (payload) => {
        this.handleUserJoined(payload.payload);
      })
      .on('broadcast', { event: 'user-left' }, (payload) => {
        this.handleUserLeft(payload.payload);
      })
      .subscribe();
  }

  async initializeMedia(video: boolean = true, audio: boolean = true): Promise<MediaStream> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: video,
        audio: audio
      });
      return this.localStream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  }

  async startScreenShare(): Promise<MediaStream> {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      
      // Replace video track in all peer connections
      const videoTrack = screenStream.getVideoTracks()[0];
      this.peers.forEach(({ peer }) => {
        const sender = peer._pc?.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      });

      return screenStream;
    } catch (error) {
      console.error('Error starting screen share:', error);
      throw error;
    }
  }

  async joinMeeting() {
    // Announce joining
    await this.signalingChannel.send({
      type: 'broadcast',
      event: 'user-joined',
      payload: { participantId: this.participantId }
    });
  }

  private async handleUserJoined(data: { participantId: string }) {
    if (data.participantId === this.participantId) return;

    // Create peer connection as initiator
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: this.localStream || undefined
    });

    peer.on('signal', (signal) => {
      this.sendSignal(data.participantId, signal);
    });

    peer.on('stream', (stream) => {
      this.onStreamCallback?.(data.participantId, stream);
    });

    peer.on('error', (error) => {
      console.error('Peer error:', error);
    });

    this.peers.set(data.participantId, {
      peerId: data.participantId,
      peer
    });
  }

  private async handleSignal(data: { from: string; to: string; signal: any }) {
    if (data.to !== this.participantId) return;

    let peerConnection = this.peers.get(data.from);

    if (!peerConnection) {
      // Create peer connection as receiver
      const peer = new Peer({
        initiator: false,
        trickle: false,
        stream: this.localStream || undefined
      });

      peer.on('signal', (signal) => {
        this.sendSignal(data.from, signal);
      });

      peer.on('stream', (stream) => {
        this.onStreamCallback?.(data.from, stream);
      });

      peer.on('error', (error) => {
        console.error('Peer error:', error);
      });

      peerConnection = {
        peerId: data.from,
        peer
      };
      this.peers.set(data.from, peerConnection);
    }

    peerConnection.peer.signal(data.signal);
  }

  private async sendSignal(to: string, signal: any) {
    await this.signalingChannel.send({
      type: 'broadcast',
      event: 'signal',
      payload: {
        from: this.participantId,
        to,
        signal
      }
    });
  }

  private handleUserLeft(data: { participantId: string }) {
    const peerConnection = this.peers.get(data.participantId);
    if (peerConnection) {
      peerConnection.peer.destroy();
      this.peers.delete(data.participantId);
      this.onPeerLeftCallback?.(data.participantId);
    }
  }

  onStream(callback: (peerId: string, stream: MediaStream) => void) {
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

  async leaveMeeting() {
    // Announce leaving
    await this.signalingChannel.send({
      type: 'broadcast',
      event: 'user-left',
      payload: { participantId: this.participantId }
    });

    // Clean up
    this.peers.forEach(({ peer }) => peer.destroy());
    this.peers.clear();
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }

    this.signalingChannel.unsubscribe();
  }
}