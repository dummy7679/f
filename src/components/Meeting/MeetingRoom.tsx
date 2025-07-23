import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { 
  Video, VideoOff, Mic, MicOff, Monitor, MonitorOff, 
  MessageSquare, Users, Hand, PhoneOff, Settings,
  Copy, Send, MoreVertical
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useDaily } from '@daily-co/daily-react-hooks';
import DailyIframe from '@daily-co/daily-js';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
}

interface Participant {
  id: string;
  name: string;
  user_id?: string;
  joined_at: string;
  is_host: boolean;
}

export function MeetingRoom() {
  const { meetingCode } = useParams<{ meetingCode: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Daily.co state
  const callFrame = useRef<any>(null);
  const [callObject, setCallObject] = useState<any>(null);
  const [participants, setParticipants] = useState<any>({});
  const [isJoined, setIsJoined] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Meeting state
  const [meeting, setMeeting] = useState<any>(null);
  const [meetingParticipants, setMeetingParticipants] = useState<Participant[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  
  // UI state
  const [activeTab, setActiveTab] = useState<'chat' | 'participants'>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Media state
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);

  useEffect(() => {
    if (meetingCode) {
      initializeMeeting();
    }
    return () => {
      if (callObject) {
        callObject.destroy();
      }
    };
  }, [meetingCode]);

  const initializeMeeting = async () => {
    try {
      // Fetch meeting details
      const { data: meetingData, error: meetingError } = await supabase
        .from('meetings')
        .select('*')
        .eq('access_code', meetingCode?.toUpperCase())
        .single();

      if (meetingError) throw meetingError;
      
      setMeeting(meetingData);

      // Create Daily.co room URL (in production, you'd create this via Daily.co API)
      const roomUrl = `https://metstack.daily.co/${meetingCode?.toLowerCase()}`;
      
      // Initialize Daily.co
      const callFrame = DailyIframe.createFrame({
        showLeaveButton: false,
        iframeStyle: {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          border: 'none',
        },
      });

      setCallObject(callFrame);
      
      // Join the call
      await callFrame.join({ 
        url: roomUrl,
        userName: location.state?.participantName || 'Guest'
      });

      setIsJoined(true);
      setIsLoading(false);

      // Set up event listeners
      callFrame.on('participant-joined', handleParticipantJoined);
      callFrame.on('participant-left', handleParticipantLeft);
      callFrame.on('participant-updated', handleParticipantUpdated);

      // Subscribe to real-time updates
      subscribeToRealtimeUpdates();
      
    } catch (error: any) {
      console.error('Error initializing meeting:', error);
      toast.error('Failed to join meeting');
      navigate('/');
    }
  };

  const handleParticipantJoined = (event: any) => {
    setParticipants(prev => ({
      ...prev,
      [event.participant.session_id]: event.participant
    }));
  };

  const handleParticipantLeft = (event: any) => {
    setParticipants(prev => {
      const updated = { ...prev };
      delete updated[event.participant.session_id];
      return updated;
    });
  };

  const handleParticipantUpdated = (event: any) => {
    setParticipants(prev => ({
      ...prev,
      [event.participant.session_id]: event.participant
    }));
  };

  const subscribeToRealtimeUpdates = () => {
    if (!meeting?.id) return;

    // Subscribe to chat messages
    const chatChannel = supabase
      .channel(`meeting-chat-${meeting.id}`)
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: `meeting_id=eq.${meeting.id}`
        }, 
        (payload) => {
          setChatMessages(prev => [...prev, payload.new as ChatMessage]);
        }
      )
      .subscribe();

    return () => {
      chatChannel.unsubscribe();
    };
  };

  const toggleMute = async () => {
    if (callObject) {
      await callObject.setLocalAudio(!isMuted);
      setIsMuted(!isMuted);
    }
  };

  const toggleCamera = async () => {
    if (callObject) {
      await callObject.setLocalVideo(!isCameraOff);
      setIsCameraOff(!isCameraOff);
    }
  };

  const toggleScreenShare = async () => {
    if (callObject) {
      if (isScreenSharing) {
        await callObject.stopScreenShare();
      } else {
        await callObject.startScreenShare();
      }
      setIsScreenSharing(!isScreenSharing);
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
          sender_name: location.state?.participantName || 'Guest',
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
    if (callObject) {
      await callObject.leave();
      callObject.destroy();
    }
    navigate('/');
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
        {/* Video container */}
        <div className="absolute inset-0" ref={callFrame} />
        
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
              People ({Object.keys(participants).length})
            </button>
          </div>
        </div>

        {/* Sidebar content */}
        <div className="flex-1 flex flex-col">
          {activeTab === 'chat' ? (
            <>
              {/* Chat messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                {Object.values(participants).map((participant: any) => (
                  <div key={participant.session_id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-medium text-sm">
                        {participant.user_name?.charAt(0)?.toUpperCase() || 'G'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {participant.user_name || 'Guest'}
                        {participant.local && ' (You)'}
                        {participant.owner && ' (Host)'}
                      </p>
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        {participant.audio && <Mic className="w-3 h-3" />}
                        {!participant.audio && <MicOff className="w-3 h-3" />}
                        {participant.video && <Video className="w-3 h-3" />}
                        {!participant.video && <VideoOff className="w-3 h-3" />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}