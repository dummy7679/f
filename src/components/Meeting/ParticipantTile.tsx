import React from 'react';
import { Mic, MicOff, Video, VideoOff, Hand } from 'lucide-react';

interface ParticipantTileProps {
  participant: {
    session_id: string;
    user_name: string;
    local: boolean;
    owner: boolean;
    audio: boolean;
    video: boolean;
    screen?: boolean;
  };
  isLarge?: boolean;
}

export function ParticipantTile({ participant, isLarge = false }: ParticipantTileProps) {
  const initials = participant.user_name?.split(' ')
    .map(name => name.charAt(0))
    .join('')
    .toUpperCase() || 'G';

  return (
    <div className={`relative bg-gray-800 rounded-lg overflow-hidden ${
      isLarge ? 'aspect-video' : 'aspect-square'
    }`}>
      {/* Video placeholder - In production, this would show actual video */}
      <div className="absolute inset-0 flex items-center justify-center">
        {participant.video ? (
          <div className="text-center text-white">
            <div className={`bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center ${
              isLarge ? 'w-24 h-24' : 'w-16 h-16'
            }`}>
              <span className={`text-white font-semibold ${isLarge ? 'text-2xl' : 'text-lg'}`}>
                {initials}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center text-white">
            <VideoOff className={`mx-auto mb-2 text-gray-400 ${isLarge ? 'w-8 h-8' : 'w-6 h-6'}`} />
            <div className={`bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center ${
              isLarge ? 'w-24 h-24' : 'w-16 h-16'
            }`}>
              <span className={`text-white font-semibold ${isLarge ? 'text-2xl' : 'text-lg'}`}>
                {initials}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Participant info overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className={`text-white font-medium ${isLarge ? 'text-base' : 'text-sm'}`}>
              {participant.user_name || 'Guest'}
              {participant.local && ' (You)'}
            </span>
            {participant.owner && (
              <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded">
                Host
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-1">
            {participant.audio ? (
              <Mic className="w-4 h-4 text-green-400" />
            ) : (
              <MicOff className="w-4 h-4 text-red-400" />
            )}
            {!participant.video && (
              <VideoOff className="w-4 h-4 text-red-400" />
            )}
          </div>
        </div>
      </div>

      {/* Screen sharing indicator */}
      {participant.screen && (
        <div className="absolute top-3 left-3">
          <span className="text-xs bg-green-500 text-white px-2 py-1 rounded">
            Sharing Screen
          </span>
        </div>
      )}
    </div>
  );
}