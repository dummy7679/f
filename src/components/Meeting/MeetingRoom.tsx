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
  const [participantId] = useState(() => crypto.randomUUID());
  
  // UI state
  const [activeTab, setActiveTab] = useState<'chat' | 'participants'>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Media state
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [handRaisedParticipants, setHandRaisedParticipants] = useState<Set<string>>(new Set());

  // WebRTC
  const [webrtcManager, setWebrtcManager] = useState<WebRTCManager | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, { stream: MediaStream; name: string }>>(new Map());

  // Refs
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const participantsRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
    if (chatRefreshIntervalRef.current) {
      clearInterval(chatRefreshIntervalRef.current);
    }
    if (participantsRefreshIntervalRef.current) {
      clearInterval(participantsRefreshIntervalRef.current);
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
      const manager = new WebRTCManager(meetingData.id, participantId, name);
      setWebrtcManager(manager);

      // Setup WebRTC callbacks
      manager.onStream((peerId, stream, participantName) => {
        console.log('Received stream from:', participantName);
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.set(peerId, { stream, name: participantName });
          return newMap;
        });
        
        // Force re-render to show new participant immediately
        setTimeout(() => {
          fetchParticipants(meetingData.id);
        }, 100);
      });

      manager.onPeerLeft((peerId) => {
        console.log('Peer left:', peerId);
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.delete(peerId);
          return newMap;
        });
        setHandRaisedParticipants(prev => {
          const newSet = new Set(prev);
          newSet.delete(peerId);
          return newSet;
        });
        
        // Update participants list immediately
        setTimeout(() => {
          fetchParticipants(meetingData.id);
        }, 100);
      });

      manager.onHandRaised((participantId, name, raised) => {
        setHandRaisedParticipants(prev => {
          const newSet = new Set(prev);
          if (raised) {
            newSet.add(participantId);
            toast.success(`${name} raised their hand`);
          } else {
            newSet.delete(participantId);
          }
          return newSet;
        });
      });

      // Initialize media with enhanced quality
      const videoEnabled = location.state?.videoEnabled !== false;
      const audioEnabled = location.state?.audioEnabled !== false;
      
      const stream = await manager.initializeMedia(videoEnabled, audioEnabled);
      setLocalStream(stream);
      setIsCameraOff(!videoEnabled);
      setIsMuted(!audioEnabled);

      // Join the meeting
      await manager.joinMeeting();

      // Start real-time updates
      startRealtimeUpdates(meetingData.id);
      
      setIsLoading(false);
      toast.success('Joined meeting successfully!');
      
    } catch (error: any) {
      console.error('Error initializing meeting:', error);
      toast.error('Failed to join meeting');
      navigate('/');
    }
  };

  const startRealtimeUpdates = (meetingId: string) => {
    // Fetch initial data
    fetchChatMessages(meetingId);
    fetchParticipants(meetingId);

    // Set up chat refresh every 500ms for better real-time feel
    chatRefreshIntervalRef.current = setInterval(() => {
      fetchChatMessages(meetingId);
    }, 500);

    // Set up participants refresh every 1 second
    participantsRefreshIntervalRef.current = setInterval(() => {
      fetchParticipants(meetingId);
    }, 1000);
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
      const newMutedState = !isMuted;
      webrtcManager.toggleAudio(!newMutedState);
      setIsMuted(newMutedState);
      toast.success(newMutedState ? 'Microphone muted' : 'Microphone unmuted');
    }
  };

  const toggleCamera = () => {
    if (webrtcManager) {
      const newCameraState = !isCameraOff;
      webrtcManager.toggleVideo(!newCameraState);
      setIsCameraOff(newCameraState);
      toast.success(newCameraState ? 'Camera turned off' : 'Camera turned on');
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
        const videoTrack = screenStream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.onended = async () => {
            setIsScreenSharing(false);
            const stream = await webrtcManager.initializeMedia(true, true);
            setLocalStream(stream);
            toast.info('Screen sharing ended');
          };
        }
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
      toast.error('Failed to toggle screen sharing');
    }
  };

  const toggleHandRaise = async () => {
    if (!webrtcManager) return;

    const newHandRaisedState = !handRaised;
    setHandRaised(newHandRaisedState);
    await webrtcManager.raiseHand(newHandRaisedState);
    toast.success(newHandRaisedState ? 'Hand raised' : 'Hand lowered');
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
      // Immediately fetch messages to show the new message
      fetchChatMessages(meeting.id);
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
    <div className="h-screen bg-gray-900 flex flex-col lg:flex-row overflow-hidden">
      {/* Main video area */}
      <div className="flex-1 relative min-h-0">
        {/* Video Grid */}
        <VideoGrid
          localStream={localStream || undefined}
          remoteStreams={remoteStreams}
          localParticipantName={participantName}
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          isScreenSharing={isScreenSharing}
          handRaisedParticipants={handRaisedParticipants}
          localHandRaised={handRaised}
        />
        
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-3 lg:p-6 z-10">
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center space-x-2 lg:space-x-4 min-w-0">
              <h1 className="text-sm lg:text-xl font-semibold truncate">{meeting?.title}</h1>
              <span className="text-xs lg:text-sm opacity-75 hidden sm:block">
                {format(new Date(), 'HH:mm')}
              </span>
              <span className="text-xs lg:text-sm bg-white/20 px-2 py-1 rounded whitespace-nowrap">
                {participants.length} participant{participants.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center space-x-1 lg:space-x-2">
              <button
                onClick={copyMeetingLink}
                className="px-2 lg:px-3 py-1 bg-white/20 rounded-lg hover:bg-white/30 transition-all text-xs lg:text-sm flex items-center gap-1 lg:gap-2"
              >
                <Copy className="w-3 h-3 lg:w-4 lg:h-4" />
                <span className="hidden sm:inline">Copy Link</span>
              </button>
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-all"
              >
                <MoreVertical className="w-4 h-4 lg:w-5 lg:h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-3 lg:p-6 z-10">
          <div className="flex items-center justify-center space-x-2 lg:space-x-4 flex-wrap gap-2">
            <button
              onClick={toggleMute}
              className={`p-3 lg:p-4 rounded-full transition-all ${
                isMuted 
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-white/20 hover:bg-white/30'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <MicOff className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
              ) : (
                <Mic className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
              )}
            </button>

            <button
              onClick={toggleCamera}
              className={`p-3 lg:p-4 rounded-full transition-all ${
                isCameraOff 
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-white/20 hover:bg-white/30'
              }`}
              title={isCameraOff ? 'Turn on camera' : 'Turn off camera'}
            >
              {isCameraOff ? (
                <VideoOff className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
              ) : (
                <Video className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
              )}
            </button>

            <button
              onClick={toggleScreenShare}
              className={`p-3 lg:p-4 rounded-full transition-all ${
                isScreenSharing 
                  ? 'bg-blue-500 hover:bg-blue-600' 
                  : 'bg-white/20 hover:bg-white/30'
              }`}
              title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
            >
              {isScreenSharing ? (
                <MonitorOff className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
              ) : (
                <Monitor className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
              )}
            </button>

            <button
              onClick={toggleHandRaise}
              className={`p-3 lg:p-4 rounded-full transition-all ${
                handRaised 
                  ? 'bg-yellow-500 hover:bg-yellow-600' 
                  : 'bg-white/20 hover:bg-white/30'
              }`}
              title={handRaised ? 'Lower hand' : 'Raise hand'}
            >
              <Hand className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
            </button>

            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-3 lg:p-4 rounded-full bg-white/20 hover:bg-white/30 transition-all"
              title="Toggle chat"
            >
              <MessageSquare className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
            </button>

            <button
              onClick={leaveMeeting}
              className="p-3 lg:p-4 rounded-full bg-red-500 hover:bg-red-600 transition-all"
              title="Leave meeting"
            >
              <PhoneOff className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className={`
        fixed lg:relative top-0 right-0 h-full w-full sm:w-80 lg:w-80 
        bg-white border-l border-gray-200 flex flex-col 
        transition-all duration-300 z-50 lg:z-auto
        ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}
        lg:translate-x-0
      `}>
        {/* Mobile close button */}
        <div className="lg:hidden absolute top-4 left-4 z-10">
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Sidebar header */}
        <div className="p-4 border-b border-gray-200 pt-16 lg:pt-4">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 px-2 lg:px-3 py-2 text-xs lg:text-sm font-medium rounded-lg transition-all ${
                activeTab === 'chat'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <MessageSquare className="w-3 h-3 lg:w-4 lg:h-4 inline mr-1 lg:mr-2" />
              Chat
            </button>
            <button
              onClick={() => setActiveTab('participants')}
              className={`flex-1 px-2 lg:px-3 py-2 text-xs lg:text-sm font-medium rounded-lg transition-all ${
                activeTab === 'participants'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Users className="w-3 h-3 lg:w-4 lg:h-4 inline mr-1 lg:mr-2" />
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
                className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-3 lg:space-y-4"
              >
                {chatMessages.map((message) => (
                  <div key={message.id} className="flex flex-col space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs lg:text-sm font-medium text-gray-900">
                        {message.sender_name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {format(new Date(message.created_at), 'HH:mm')}
                      </span>
                    </div>
                    <p className="text-xs lg:text-sm text-gray-700 bg-gray-50 rounded-lg px-2 lg:px-3 py-1 lg:py-2">
                      {message.content}
                    </p>
                  </div>
                ))}
                {chatMessages.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs lg:text-sm">No messages yet</p>
                    <p className="text-xs">Start the conversation!</p>
                  </div>
                )}
              </div>

              {/* Chat input */}
              <div className="p-3 lg:p-4 border-t border-gray-200">
                <form onSubmit={sendMessage} className="flex space-x-1 lg:space-x-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-2 lg:px-3 py-2 text-xs lg:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <Send className="w-3 h-3 lg:w-4 lg:h-4" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            /* Participants list */
            <div className="flex-1 overflow-y-auto p-3 lg:p-4">
              <div className="space-y-2 lg:space-y-3">
                {participants.map((participant) => (
                  <div key={participant.id} className="flex items-center space-x-2 lg:space-x-3 p-2 lg:p-3 rounded-lg hover:bg-gray-50">
                    <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-medium text-xs lg:text-sm">
                        {participant.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <p className="text-xs lg:text-sm font-medium text-gray-900">
                          {participant.name}
                          {participant.name === participantName && ' (You)'}
                          {participant.name === meeting?.host_name && ' (Host)'}
                        </p>
                        {handRaisedParticipants.has(participant.id) && (
                          <Hand className="w-3 h-3 lg:w-4 lg:h-4 text-yellow-500" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        Joined {format(new Date(participant.joined_at), 'HH:mm')}
                      </p>
                    </div>
                  </div>
                ))}
                {participants.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs lg:text-sm">No participants yet</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}