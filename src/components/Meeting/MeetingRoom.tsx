import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { 
  Video, VideoOff, Mic, MicOff, Monitor, MonitorOff, 
  MessageSquare, Users, Hand, PhoneOff, Settings,
  Copy, Send, MoreVertical
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { WebRTCManager } from '../../lib/webrtc';
import { VideoGrid } from './VideoGrid';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

interface ChatMessage {
  id: string;
  sender_id: string | null;
  sender_name: string;
  content: string;
  created_at: string;
}

interface Participant {
  id: string;
  name: string;
  user_id?: string;
  joined_at: string;
}

export function MeetingRoom() {
  const { meetingCode } = useParams<{ meetingCode: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Meeting state
  const [meeting, setMeeting] = useState<any>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [participantName, setParticipantName] = useState('');
  const [participantId] = useState(uuidv4());
  
  // UI state
  const [activeTab, setActiveTab] = useState<'chat' | 'participants'>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Media state
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);

  // WebRTC
  const [webrtcManager, setWebrtcManager] = useState<WebRTCManager | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, { stream: MediaStream; name: string }>>(new Map());

  // Refs
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatChannelRef = useRef<any>(null);
  const participantsChannelRef = useRef<any>(null);

  useEffect(() => {
    if (meetingCode) {
      initializeMeeting();
    }
    return () => {
      cleanup();
    };
  }, [meetingCode]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const cleanup = () => {
    if (webrtcManager) {
      webrtcManager.leaveMeeting();
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (chatChannelRef.current) {
      chatChannelRef.current.unsubscribe();
    }
    if (participantsChannelRef.current) {
      participantsChannelRef.current.unsubscribe();
    }
  };

  const initializeMeeting = async () => {
    try {
      // Get participant name from location state or prompt
      const name = location.state?.participantName || 
                   location.state?.hostName || 
                   prompt('Enter your name:') || 
                   'Guest';
      
      setParticipantName(name);

      // Fetch meeting details
      const { data: meetingData, error: meetingError } = await supabase
        .from('meetings')
        .select('*')
        .eq('access_code', meetingCode?.toUpperCase())
        .single();

      if (meetingError) {
        toast.error('Meeting not found');
        navigate('/');
        return;
      }
      
      setMeeting(meetingData);

      // Add participant to database
      const { error: participantError } = await supabase
        .from('participants')
        .insert({
          meeting_id: meetingData.id,
          name: name,
          user_id: null,
        });

      if (participantError) {
        console.error('Error adding participant:', participantError);
      }

      // Initialize WebRTC
      const manager = new WebRTCManager(meetingData.id, participantId);
      setWebrtcManager(manager);

      // Setup WebRTC callbacks
      manager.onStream((peerId, stream) => {
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.set(peerId, { stream, name: `Participant ${peerId.slice(0, 8)}` });
          return newMap;
        });
      });

      manager.onPeerLeft((peerId) => {
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.delete(peerId);
          return newMap;
        });
      });

      // Initialize media
      const stream = await manager.initializeMedia(true, true);
      setLocalStream(stream);

      // Join the meeting
      await manager.joinMeeting();

      // Subscribe to real-time updates
      subscribeToRealtimeUpdates(meetingData.id);
      
      setIsLoading(false);
      toast.success('Joined meeting successfully!');
      
    } catch (error: any) {
      console.error('Error initializing meeting:', error);
      toast.error('Failed to join meeting');
      navigate('/');
    }
  };

  const subscribeToRealtimeUpdates = (meetingId: string) => {
    // Subscribe to chat messages with real-time refresh
    chatChannelRef.current = supabase
      .channel(`meeting-chat-${meetingId}`)
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: `meeting_id=eq.${meetingId}`
        }, 
        (payload) => {
          setChatMessages(prev => [...prev, payload.new as ChatMessage]);
        }
      )
      .subscribe();

    // Subscribe to participants
    participantsChannelRef.current = supabase
      .channel(`meeting-participants-${meetingId}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'participants',
          filter: `meeting_id=eq.${meetingId}`
        }, 
        () => {
          fetchParticipants(meetingId);
        }
      )
      .subscribe();

    // Fetch initial data
    fetchChatMessages(meetingId);
    fetchParticipants(meetingId);

    // Set up periodic refresh for chat (every 2 seconds)
    const chatRefreshInterval = setInterval(() => {
      fetchChatMessages(meetingId);
    }, 2000);

    // Set up periodic refresh for participants (every 5 seconds)
    const participantsRefreshInterval = setInterval(() => {
      fetchParticipants(meetingId);
    }, 5000);

    return () => {
      clearInterval(chatRefreshInterval);
      clearInterval(participantsRefreshInterval);
    };
  };

  const fetchChatMessages = async (meetingId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setChatMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const fetchParticipants = async (meetingId: string) => {
    try {
      const { data, error } = await supabase
        .from('participants')
        .select('*')
        .eq('meeting_id', meetingId)
        .is('left_at', null)
        .order('joined_at', { ascending: true });

      if (error) throw error;
      setParticipants(data || []);
    } catch (error) {
      console.error('Error fetching participants:', error);
    }
  };

  const toggleMute = () => {
    if (webrtcManager) {
      webrtcManager.toggleAudio(!isMuted);
      setIsMuted(!isMuted);
      toast.success(isMuted ? 'Microphone unmuted' : 'Microphone muted');
    }
  };

  const toggleCamera = () => {
    if (webrtcManager) {
      webrtcManager.toggleVideo(!isCameraOff);
      setIsCameraOff(!isCameraOff);
      toast.success(isCameraOff ? 'Camera turned on' : 'Camera turned off');
    }
  };

  const toggleScreenShare = async () => {
    if (!webrtcManager) return;

    try {
      if (isScreenSharing) {
        // Stop screen sharing and return to camera
        const stream = await webrtcManager.initializeMedia(true, true);
        setLocalStream(stream);
        setIsScreenSharing(false);
        toast.success('Screen sharing stopped');
      } else {
        // Start screen sharing
        const screenStream = await webrtcManager.startScreenShare();
        setLocalStream(screenStream);
        setIsScreenSharing(true);
        toast.success('Screen sharing started');
        
        // Listen for screen share end
        screenStream.getVideoTracks()[0].onended = async () => {
          setIsScreenSharing(false);
          const stream = await webrtcManager.initializeMedia(true, true);
          setLocalStream(stream);
        };
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
      toast.error('Failed to toggle screen sharing');
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !meeting?.id) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          meeting_id: meeting.id,
          sender_id: null,
          sender_name: participantName,
          content: newMessage.trim(),
        });

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const leaveMeeting = async () => {
    try {
      // Update participant as left
      if (meeting?.id) {
        await supabase
          .from('participants')
          .update({ left_at: new Date().toISOString() })
          .eq('meeting_id', meeting.id)
          .eq('name', participantName);
      }

      cleanup();
      toast.success('Left meeting');
      navigate('/');
    } catch (error) {
      console.error('Error leaving meeting:', error);
      navigate('/');
    }
  };

  const copyMeetingLink = () => {
    const meetingLink = `${window.location.origin}/join/${meetingCode}`;
    navigator.clipboard.writeText(meetingLink);
    toast.success('Meeting link copied to clipboard!');
  };

  if (isLoading) {
    return (
      <div className="h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-lg">Joining meeting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 flex">
      {/* Main video area */}
      <div className="flex-1 relative">
        {/* Video Grid */}
        <VideoGrid
          localStream={localStream || undefined}
          remoteStreams={remoteStreams}
          localParticipantName={participantName}
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          isScreenSharing={isScreenSharing}
        />
        
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/50 to-transparent p-6 z-10">
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold">{meeting?.title}</h1>
              <span className="text-sm opacity-75">
                {format(new Date(), 'HH:mm')}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={copyMeetingLink}
                className="px-3 py-1 bg-white/20 rounded-lg hover:bg-white/30 transition-all text-sm flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy Link
              </button>
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-all lg:hidden"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6 z-10">
          <div className="flex items-center justify-center space-x-4">
            <button
              onClick={toggleMute}
              className={`p-4 rounded-full transition-all ${
                isMuted 
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-white/20 hover:bg-white/30'
              }`}
            >
              {isMuted ? (
                <MicOff className="w-6 h-6 text-white" />
              ) : (
                <Mic className="w-6 h-6 text-white" />
              )}
            </button>

            <button
              onClick={toggleCamera}
              className={`p-4 rounded-full transition-all ${
                isCameraOff 
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-white/20 hover:bg-white/30'
              }`}
            >
              {isCameraOff ? (
                <VideoOff className="w-6 h-6 text-white" />
              ) : (
                <Video className="w-6 h-6 text-white" />
              )}
            </button>

            <button
              onClick={toggleScreenShare}
              className={`p-4 rounded-full transition-all ${
                isScreenSharing 
                  ? 'bg-blue-500 hover:bg-blue-600' 
                  : 'bg-white/20 hover:bg-white/30'
              }`}
            >
              {isScreenSharing ? (
                <MonitorOff className="w-6 h-6 text-white" />
              ) : (
                <Monitor className="w-6 h-6 text-white" />
              )}
            </button>

            <button
              onClick={() => setHandRaised(!handRaised)}
              className={`p-4 rounded-full transition-all ${
                handRaised 
                  ? 'bg-yellow-500 hover:bg-yellow-600' 
                  : 'bg-white/20 hover:bg-white/30'
              }`}
            >
              <Hand className="w-6 h-6 text-white" />
            </button>

            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-4 rounded-full bg-white/20 hover:bg-white/30 transition-all lg:hidden"
            >
              <MessageSquare className="w-6 h-6 text-white" />
            </button>

            <button
              onClick={leaveMeeting}
              className="p-4 rounded-full bg-red-500 hover:bg-red-600 transition-all"
            >
              <PhoneOff className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className={`w-80 bg-white border-l border-gray-200 flex flex-col transition-all duration-300 ${
        sidebarOpen ? 'translate-x-0' : 'translate-x-full'
      } lg:translate-x-0`}>
        {/* Sidebar header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'chat'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <MessageSquare className="w-4 h-4 inline mr-2" />
              Chat
            </button>
            <button
              onClick={() => setActiveTab('participants')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'participants'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              People ({participants.length})
            </button>
          </div>
        </div>

        {/* Sidebar content */}
        <div className="flex-1 flex flex-col">
          {activeTab === 'chat' ? (
            <>
              {/* Chat messages */}
              <div 
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-4"
              >
                {chatMessages.map((message) => (
                  <div key={message.id} className="flex flex-col space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900">
                        {message.sender_name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {format(new Date(message.created_at), 'HH:mm')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
                      {message.content}
                    </p>
                  </div>
                ))}
                {chatMessages.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No messages yet</p>
                    <p className="text-xs">Start the conversation!</p>
                  </div>
                )}
              </div>

              {/* Chat input */}
              <div className="p-4 border-t border-gray-200">
                <form onSubmit={sendMessage} className="flex space-x-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            /* Participants list */
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {participants.map((participant) => (
                  <div key={participant.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-medium text-sm">
                        {participant.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {participant.name}
                        {participant.name === participantName && ' (You)'}
                        {participant.name === meeting?.host_name && ' (Host)'}
                      </p>
                      <p className="text-xs text-gray-500">
                        Joined {format(new Date(participant.joined_at), 'HH:mm')}
                      </p>
                    </div>
                  </div>
                ))}
                {participants.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No participants yet</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}