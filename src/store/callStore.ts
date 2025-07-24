// src/store/callStore.ts
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { useAuthStore } from "./authStore";

interface CallParticipant {
  id: string;
  name: string;
  avatar?: string;
  status: "connecting" | "connected" | "disconnected";
  isMuted: boolean;
  isVideoEnabled: boolean;
  stream?: MediaStream;
}

interface Call {
  id: string;
  type: "incoming" | "outgoing" | "missed";
  callType: "voice" | "video";
  participants: CallParticipant[];
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: "connecting" | "ringing" | "connected" | "ended" | "failed";
  conversationId?: string;
  isGroupCall: boolean;
}

interface CallHistory {
  id: string;
  participantId: string;
  participantName: string;
  participantAvatar?: string;
  type: "incoming" | "outgoing" | "missed";
  callType: "voice" | "video";
  timestamp: Date;
  duration?: number;
  status: "completed" | "missed" | "failed";
}

interface CallState {
  currentCall: Call | null;
  isInCall: boolean;
  isConnecting: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isSpeakerOn: boolean;
  handRaised: boolean;
  showAcceptButton: boolean;
  callHistory: CallHistory[];
  isLoadingHistory: boolean;
  currentTab: "missed" | "pending" | "requests";
  showDialPad: boolean;
  showNewCallModal: boolean;
  isConnected: boolean;
  connectionError: string | null;
  setCurrentTab: (tab: "missed" | "pending" | "requests") => void;
  setShowDialPad: (show: boolean) => void;
  setShowNewCallModal: (show: boolean) => void;
  initializeMedia: (callType: "voice" | "video") => Promise<MediaStream>;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleSpeaker: () => void;
  toggleHandRaise: () => void;
  shareScreen: () => Promise<void>;
  startCall: (participantId: string, callType: "voice" | "video") => Promise<MediaStream>;
  startGroupCall: (participantIds: string[], callType: "voice" | "video") => Promise<MediaStream>;
  answerCall: () => Promise<MediaStream>;
  rejectCall: () => void;
  endCall: () => void;
  fetchCallHistory: () => Promise<void>;
  addCallToHistory: (call: CallHistory) => void;
  setConnected: (connected: boolean) => void;
  setConnectionError: (error: string | null) => void;
  setCurrentCall: (call: Call | null) => void;
  setIsInCall: (inCall: boolean) => void;
  setIsConnecting: (connecting: boolean) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
}

const API_BASE_URL = "https://calls-dev.wasaachat.com";
const API_KEY = "QgR1v+o16jphR9AMSJ9Qf8SnOqmMd4HPziLZvMU1Mt0t7ocaT38q/8AsuOII2YxM60WaXQMkFIYv2bqo+pS/sw==";

export const useCallStore = create<CallState>()(
  devtools(
    (set, get) => ({
      currentCall: null,
      isInCall: false,
      isConnecting: false,
      localStream: null,
      remoteStream: null,
      isMuted: false,
      isVideoEnabled: true,
      isSpeakerOn: false,
      handRaised: false,
      showAcceptButton: false,
      callHistory: [],
      isLoadingHistory: false,
      currentTab: "missed",
      showDialPad: false,
      showNewCallModal: false,
      isConnected: false,
      connectionError: null,

      setCurrentTab: (tab) => set({ currentTab: tab }),
      setShowDialPad: (show) => set({ showDialPad: show }),
      setShowNewCallModal: (show) => set({ showNewCallModal: show }),

      initializeMedia: async (callType: "voice" | "video") => {
        try {
          console.log(`🎥 Initializing media for ${callType} call...`);
          const constraints = {
            audio: true,
            video: callType === "video" ? { width: 1280, height: 720 } : false,
          };
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          console.log('✅ Media stream created:', stream.getTracks().map(t => ({ kind: t.kind, id: t.id, enabled: t.enabled, readyState: t.readyState })));
          
          // CRITICAL FIX: Ensure both audio and video are enabled for video calls
          set({ 
            localStream: stream, 
            isMuted: false, 
            isVideoEnabled: callType === "video" 
          });
          return stream;
        } catch (error) {
          console.error('❌ Media initialization failed:', error);
          set({ connectionError: `Media access failed: ${error}` });
          throw error;
        }
      },

      toggleMute: () => {
        const { localStream, isMuted } = get();
        if (!localStream) {
          console.warn('⚠️ No local stream available for audio toggle');
          return;
        }
        const audioTracks = localStream.getAudioTracks();
        const newMutedState = !isMuted;
        audioTracks.forEach(track => {
          track.enabled = !newMutedState;
        });
        set({ isMuted: newMutedState });
        import('./callSocket').then(({ callSocket }) => {
          if (callSocket.isConnected()) {
            callSocket.toggleMute(newMutedState);
          }
        });
        console.log(`🎤 Audio ${newMutedState ? 'muted' : 'enabled'}`);
      },

      toggleVideo: () => {
        const { localStream, isVideoEnabled } = get();
        if (!localStream) {
          console.warn('⚠️ No local stream available for video toggle');
          return;
        }
        const videoTracks = localStream.getVideoTracks();
        const newVideoState = !isVideoEnabled;
        videoTracks.forEach(track => {
          track.enabled = newVideoState;
        });
        set({ isVideoEnabled: newVideoState });
        import('./callSocket').then(({ callSocket }) => {
          if (callSocket.isConnected()) {
            callSocket.toggleVideo(newVideoState);
          }
        });
        console.log(`📹 Video ${newVideoState ? 'enabled' : 'disabled'}`);
      },

      toggleSpeaker: () => {
        const { isSpeakerOn } = get();
        set({ isSpeakerOn: !isSpeakerOn });
        console.log(`🔊 Speaker ${!isSpeakerOn ? 'on' : 'off'}`);
      },

      toggleHandRaise: () => {
        const { handRaised } = get();
        const newHandRaisedState = !handRaised;
        set({ handRaised: newHandRaisedState });
        import('./callSocket').then(({ callSocket }) => {
          if (callSocket.isConnected()) {
            callSocket.raiseHand(newHandRaisedState);
          }
        });
        console.log(`✋ Hand ${newHandRaisedState ? 'raised' : 'lowered'}`);
      },

      shareScreen: async () => {
        try {
          console.log('🖥️ Starting screen share...');
          const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });
          const { localStream } = get();
          const originalStream = localStream;
          set({ localStream: screenStream });
          screenStream.getVideoTracks()[0].onended = () => {
            console.log('🖥️ Screen sharing ended, switching back to camera');
            set({ localStream: originalStream });
          };
          console.log('✅ Screen sharing started');
        } catch (error) {
          console.error('❌ Screen sharing failed:', error);
          set({ connectionError: `Screen sharing failed: ${error}` });
          throw error;
        }
      },

      startCall: async (participantId: string, callType: "voice" | "video") => {
        try {
          set({ isConnecting: true, connectionError: null });
          const stream = await get().initializeMedia(callType);
          const { callSocket } = await import('./callSocket');
          if (!callSocket.isConnected()) {
            throw new Error('Socket not connected');
          }
          const { user } = useAuthStore.getState();
          if (!user?.id) {
            throw new Error('User not authenticated');
          }
          await callSocket.initiateCall({
            participantIds: [participantId],
            callType,
            isGroupCall: false,
            callerId: user.id,
          });
          
          // CRITICAL FIX: Both microphone and camera enabled for caller
          set({
            currentCall: {
              id: `temp-${Date.now()}`,
              type: 'outgoing',
              callType,
              participants: [{ 
                id: participantId, 
                name: 'Unknown', 
                status: 'connecting', 
                isMuted: false, 
                isVideoEnabled: callType === 'video' 
              }],
              startTime: new Date(),
              status: 'connecting',
              isGroupCall: false,
            },
            isInCall: true,
            isMuted: false, // Microphone ON for caller
            isVideoEnabled: callType === 'video', // Camera ON for video calls
          });
          console.log(`✅ Call initiated to ${participantId} - Audio: ON, Video: ${callType === 'video' ? 'ON' : 'OFF'}`);
          return stream;
        } catch (error) {
          console.error('❌ Failed to start call:', error);
          set({ isConnecting: false, connectionError: `Failed to start call: ${error}` });
          throw error;
        }
      },

      startGroupCall: async (participantIds: string[], callType: "voice" | "video") => {
        try {
          set({ isConnecting: true, connectionError: null });
          const stream = await get().initializeMedia(callType);
          const { callSocket } = await import('./callSocket');
          if (!callSocket.isConnected()) {
            throw new Error('Socket not connected');
          }
          const { user } = useAuthStore.getState();
          if (!user?.id) {
            throw new Error('User not authenticated');
          }
          await callSocket.initiateCall({
            participantIds,
            callType,
            isGroupCall: true,
            callerId: user.id,
          });
          set({
            currentCall: {
              id: `temp-${Date.now()}`,
              type: 'outgoing',
              callType,
              participants: participantIds.map(id => ({ 
                id, 
                name: 'Unknown', 
                status: 'connecting', 
                isMuted: false, 
                isVideoEnabled: callType === 'video' 
              })),
              startTime: new Date(),
              status: 'connecting',
              isGroupCall: true,
            },
            isInCall: true,
            isMuted: false,
            isVideoEnabled: callType === 'video',
          });
          console.log(`✅ Group call initiated with ${participantIds.length} participants`);
          return stream;
        } catch (error) {
          console.error('❌ Failed to start group call:', error);
          set({ isConnecting: false, connectionError: `Failed to start group call: ${error}` });
          throw error;
        }
      },

      answerCall: async () => {
        try {
          const callType = get().currentCall?.callType || 'voice';
          const stream = await get().initializeMedia(callType);
          const { callSocket } = await import('./callSocket');
          if (!callSocket.isConnected()) {
            throw new Error('Socket not connected');
          }
          callSocket.answerCall();
          
          // CRITICAL FIX: Both microphone and camera enabled for callee
          set({ 
            showAcceptButton: false, 
            isInCall: true, 
            isMuted: false, // Microphone ON for callee
            isVideoEnabled: callType === 'video', // Camera ON for video calls
            connectionError: null 
          });
          console.log(`✅ Call answered - Audio: ON, Video: ${callType === 'video' ? 'ON' : 'OFF'}`);
          return stream;
        } catch (error) {
          console.error('❌ Failed to answer call:', error);
          set({ connectionError: `Failed to answer call: ${error}` });
          throw error;
        }
      },

      rejectCall: () => {
        import('./callSocket').then(({ callSocket }) => {
          callSocket.rejectCall();
        });
        get().endCall();
        console.log('❌ Call rejected');
      },

      endCall: () => {
        import('./callSocket').then(({ callSocket }) => {
          callSocket.endCall();
        });
        const { localStream, remoteStream } = get();
        if (localStream) {
          localStream.getTracks().forEach(track => track.stop());
        }
        if (remoteStream) {
          remoteStream.getTracks().forEach(track => track.stop());
        }
        set({
          currentCall: null,
          isInCall: false,
          isConnecting: false,
          localStream: null,
          remoteStream: null,
          showAcceptButton: false,
          isMuted: false,
          isVideoEnabled: true,
          handRaised: false,
          connectionError: null,
        });
        console.log('✅ Call ended');
      },

      fetchCallHistory: async () => {
        set({ isLoadingHistory: true, connectionError: null });
        try {
          const accessToken = localStorage.getItem('access_token');
          const { user } = useAuthStore.getState();
          if (!accessToken || !user?.id) {
            throw new Error('No authentication data available');
          }
          const response = await fetch(`${API_BASE_URL}/v1/calls/user/${user.id}`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'x-api-key': API_KEY,
              'Content-Type': 'application/json',
            },
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText || 'Failed to fetch call history'}`);
          }
          const data = await response.json();
          console.log('📜 Call history response:', JSON.stringify(data, null, 2));
          let calls: unknown[] = [];
          if (Array.isArray(data)) {
            calls = data;
          } else if (data && Array.isArray(data.calls)) {
            calls = data.calls;
          } else {
            console.warn('⚠️ Unexpected response format:', data);
            calls = [];
          }
          
          // CRITICAL FIX: Proper type assertion for map function
          const callHistory: CallHistory[] = calls
            .filter((call): call is Record<string, unknown> => 
              typeof call === 'object' && call !== null
            )
            .map((call) => ({
              id: (call.id as string) || `temp-${Date.now()}`,
              participantId: (call.participant_id as string) || (call.participantId as string) || 'unknown',
              participantName: (call.participant_name as string) || (call.participantName as string) || 'Unknown',
              participantAvatar: (call.participant_avatar as string) || (call.participantAvatar as string),
              type: (call.type as "incoming" | "outgoing" | "missed") || 'missed',
              callType: (call.call_type as "voice" | "video") || (call.callType as "voice" | "video") || 'voice',
              timestamp: new Date((call.timestamp as string) || (call.created_at as string) || Date.now()),
              duration: (call.duration as number) || 0,
              status: (call.status as "completed" | "missed" | "failed") || 'missed',
            }));
            
          set({ callHistory, isLoadingHistory: false });
          console.log(`✅ Fetched ${callHistory.length} call history items`);
        } catch (error) {
          console.error('❌ Failed to fetch call history:', error);
          set({
            isLoadingHistory: false,
            connectionError: `Failed to fetch call history: ${error}`,
          });
        }
      },

      addCallToHistory: (call: CallHistory) => {
        const { callHistory } = get();
        set({ callHistory: [call, ...callHistory] });
      },

      setConnected: (connected) => {
        set({
          isConnected: connected,
          connectionError: connected ? null : get().connectionError,
        });
      },
      setConnectionError: (error) => set({ connectionError: error }),
      setCurrentCall: (call) => set({ currentCall: call }),
      setIsInCall: (inCall) => set({ isInCall: inCall }),
      setIsConnecting: (connecting) => set({ isConnecting: connecting }),
      setLocalStream: (stream) => set({ localStream: stream }),
      setRemoteStream: (stream) => set({ remoteStream: stream }),
    }),
    { name: "CallStore" }
  )
);