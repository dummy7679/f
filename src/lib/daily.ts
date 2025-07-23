import DailyIframe from '@daily-co/daily-js';

// Daily.co configuration
export const DAILY_API_KEY = import.meta.env.VITE_DAILY_API_KEY;
export const DAILY_DOMAIN = import.meta.env.VITE_DAILY_DOMAIN || 'metstack';

export interface DailyConfig {
  url: string;
  userName?: string;
  userData?: any;
}

export const createDailyRoom = async (roomName: string): Promise<string> => {
  // In production, you would create rooms via Daily.co REST API
  // For demo purposes, we'll use a predictable room URL
  return `https://${DAILY_DOMAIN}.daily.co/${roomName.toLowerCase()}`;
};

export const initializeDailyCall = (config: DailyConfig) => {
  const callFrame = DailyIframe.createFrame({
    showLeaveButton: false,
    showFullscreenButton: true,
    showLocalVideo: true,
    showParticipantsBar: false,
    iframeStyle: {
      position: 'absolute',
      top: '0',
      left: '0',
      right: '0',
      bottom: '0',
      width: '100%',
      height: '100%',
      border: 'none',
    },
  });

  return callFrame;
};

export const setupDailyEventListeners = (callFrame: any, callbacks: {
  onParticipantJoined?: (event: any) => void;
  onParticipantLeft?: (event: any) => void;
  onParticipantUpdated?: (event: any) => void;
  onError?: (event: any) => void;
}) => {
  if (callbacks.onParticipantJoined) {
    callFrame.on('participant-joined', callbacks.onParticipantJoined);
  }
  
  if (callbacks.onParticipantLeft) {
    callFrame.on('participant-left', callbacks.onParticipantLeft);
  }
  
  if (callbacks.onParticipantUpdated) {
    callFrame.on('participant-updated', callbacks.onParticipantUpdated);
  }
  
  if (callbacks.onError) {
    callFrame.on('error', callbacks.onError);
  }
};