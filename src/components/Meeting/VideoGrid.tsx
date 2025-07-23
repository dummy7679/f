import React, { useRef, useEffect } from 'react';
import { Mic, MicOff, Video, VideoOff, Hand } from 'lucide-react';

interface VideoTileProps {
  stream?: MediaStream;
  participantName: string;
  isLocal?: boolean;
  isMuted?: boolean;
  isCameraOff?: boolean;
  isScreenShare?: boolean;
  handRaised?: boolean;
}

function VideoTile({ 
  stream, 
  participantName, 
  isLocal = false, 
  isMuted = false, 
  isCameraOff = false,
  isScreenShare = false,
  handRaised = false
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      // Enhanced video playback with better error handling
      const playVideo = async () => {
        try {
          videoRef.current!.muted = isLocal; // Prevent echo for local video
          await videoRef.current!.play();
        } catch (error) {
          console.error('Error playing video:', error);
          // Retry after a short delay
          setTimeout(() => {
            if (videoRef.current) {
              videoRef.current.play().catch(console.error);
            }
          }, 100);
        }
      };
      playVideo();
    }
  }, [stream]);

  const initials = participantName
    .split(' ')
    .map(name => name.charAt(0))
    .join('')
    .toUpperCase();

  return (
    <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video shadow-lg">
      {stream && !isCameraOff ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover transform scale-x-[-1]"
          style={{ transform: isLocal ? 'scaleX(-1)' : 'none' }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center text-white">
            <div className="w-12 h-12 lg:w-16 lg:h-16 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-2">
              <span className="text-lg lg:text-xl font-semibold">{initials}</span>
            </div>
            <p className="text-xs lg:text-sm px-2">{participantName}</p>
          </div>
        </div>
      )}

      {/* Hand raised indicator */}
      {handRaised && (
        <div className="absolute top-2 right-2 lg:top-3 lg:right-3">
          <div className="bg-yellow-500 text-white p-1 lg:p-2 rounded-full animate-bounce shadow-lg">
            <Hand className="w-3 h-3 lg:w-4 lg:h-4" />
          </div>
        </div>
      )}

      {/* Overlay info */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 lg:p-3">
        <div className="flex items-center justify-between">
          <span className="text-white text-xs lg:text-sm font-medium truncate pr-2">
            {participantName} {isLocal && '(You)'}
          </span>
          <div className="flex items-center space-x-1 flex-shrink-0">
            {isMuted ? (
              <MicOff className="w-3 h-3 lg:w-4 lg:h-4 text-red-400" />
            ) : (
              <Mic className="w-3 h-3 lg:w-4 lg:h-4 text-green-400" />
            )}
            {isCameraOff && <VideoOff className="w-3 h-3 lg:w-4 lg:h-4 text-red-400" />}
          </div>
        </div>
      </div>

      {isScreenShare && (
        <div className="absolute top-2 left-2 lg:top-3 lg:left-3">
          <span className="text-xs bg-green-500 text-white px-1 lg:px-2 py-1 rounded shadow-lg">
            Screen Share
          </span>
        </div>
      )}
    </div>
  );
}

interface VideoGridProps {
  localStream?: MediaStream;
  remoteStreams: Map<string, { stream: MediaStream; name: string }>;
  localParticipantName: string;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  handRaisedParticipants: Set<string>;
  localHandRaised: boolean;
}

export function VideoGrid({
  localStream,
  remoteStreams,
  localParticipantName,
  isMuted,
  isCameraOff,
  isScreenSharing,
  handRaisedParticipants,
  localHandRaised
}: VideoGridProps) {
  const totalParticipants = 1 + remoteStreams.size;
  
  // Determine responsive grid layout
  const getGridClass = () => {
    if (totalParticipants === 1) return 'grid-cols-1 h-full';
    if (totalParticipants === 2) return 'grid-cols-1 sm:grid-cols-2 h-full';
    if (totalParticipants <= 4) return 'grid-cols-2 h-full';
    if (totalParticipants <= 6) return 'grid-cols-2 lg:grid-cols-3 auto-rows-fr';
    if (totalParticipants <= 9) return 'grid-cols-3 auto-rows-fr';
    return 'grid-cols-3 lg:grid-cols-4 auto-rows-fr';
  };

  // Calculate optimal aspect ratio based on screen size and participant count
  const getContainerClass = () => {
    if (totalParticipants === 1) return 'flex items-center justify-center h-full';
    return 'h-full overflow-hidden';
  };

  return (
    <div className={getContainerClass()}>
      <div className={`grid gap-2 lg:gap-4 p-2 lg:p-4 ${getGridClass()}`}>
        {/* Local video */}
        <VideoTile
          stream={localStream}
          participantName={localParticipantName}
          isLocal={true}
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          isScreenShare={isScreenSharing}
          handRaised={localHandRaised}
        />

        {/* Remote videos */}
        {Array.from(remoteStreams.entries()).map(([peerId, { stream, name }]) => (
          <VideoTile
            key={peerId}
            stream={stream}
            participantName={name}
            isLocal={false}
            handRaised={handRaisedParticipants.has(peerId)}
          />
        ))}
      </div>
    </div>
  );
}