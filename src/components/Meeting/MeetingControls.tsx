import React from 'react';
import { 
  Video, VideoOff, Mic, MicOff, Monitor, MonitorOff, 
  Hand, PhoneOff, MessageSquare, Users, Settings, Copy
} from 'lucide-react';

interface MeetingControlsProps {
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  handRaised: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onToggleHandRaise: () => void;
  onToggleChat: () => void;
  onToggleParticipants: () => void;
  onCopyLink: () => void;
  onLeaveMeeting: () => void;
  participantCount: number;
}

export function MeetingControls({
  isMuted,
  isCameraOff,
  isScreenSharing,
  handRaised,
  onToggleMute,
  onToggleCamera,
  onToggleScreenShare,
  onToggleHandRaise,
  onToggleChat,
  onToggleParticipants,
  onCopyLink,
  onLeaveMeeting,
  participantCount,
}: MeetingControlsProps) {
  return (
    <div className="flex items-center justify-center space-x-3 p-4 bg-gray-900/90 backdrop-blur-sm">
      {/* Left controls */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onToggleMute}
          className={`p-3 rounded-full transition-all ${
            isMuted 
              ? 'bg-red-500 hover:bg-red-600' 
              : 'bg-gray-700 hover:bg-gray-600'
          }`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <MicOff className="w-5 h-5 text-white" />
          ) : (
            <Mic className="w-5 h-5 text-white" />
          )}
        </button>

        <button
          onClick={onToggleCamera}
          className={`p-3 rounded-full transition-all ${
            isCameraOff 
              ? 'bg-red-500 hover:bg-red-600' 
              : 'bg-gray-700 hover:bg-gray-600'
          }`}
          title={isCameraOff ? 'Turn on camera' : 'Turn off camera'}
        >
          {isCameraOff ? (
            <VideoOff className="w-5 h-5 text-white" />
          ) : (
            <Video className="w-5 h-5 text-white" />
          )}
        </button>
      </div>

      {/* Center controls */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onToggleScreenShare}
          className={`p-3 rounded-full transition-all ${
            isScreenSharing 
              ? 'bg-blue-500 hover:bg-blue-600' 
              : 'bg-gray-700 hover:bg-gray-600'
          }`}
          title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
        >
          {isScreenSharing ? (
            <MonitorOff className="w-5 h-5 text-white" />
          ) : (
            <Monitor className="w-5 h-5 text-white" />
          )}
        </button>

        <button
          onClick={onToggleHandRaise}
          className={`p-3 rounded-full transition-all ${
            handRaised 
              ? 'bg-yellow-500 hover:bg-yellow-600' 
              : 'bg-gray-700 hover:bg-gray-600'
          }`}
          title={handRaised ? 'Lower hand' : 'Raise hand'}
        >
          <Hand className="w-5 h-5 text-white" />
        </button>

        <button
          onClick={onToggleChat}
          className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 transition-all"
          title="Toggle chat"
        >
          <MessageSquare className="w-5 h-5 text-white" />
        </button>

        <button
          onClick={onToggleParticipants}
          className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 transition-all relative"
          title="Toggle participants"
        >
          <Users className="w-5 h-5 text-white" />
          {participantCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {participantCount}
            </span>
          )}
        </button>

        <button
          onClick={onCopyLink}
          className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 transition-all"
          title="Copy meeting link"
        >
          <Copy className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Right controls */}
      <div className="flex items-center space-x-3">
        <button className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 transition-all">
          <Settings className="w-5 h-5 text-white" />
        </button>

        <button
          onClick={onLeaveMeeting}
          className="p-3 rounded-full bg-red-500 hover:bg-red-600 transition-all"
          title="Leave meeting"
        >
          <PhoneOff className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
  );
}