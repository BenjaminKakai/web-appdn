// src/store/callSocket.ts
import { useRef, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useCallStore } from './callStore';

const SOCKET_URL = 'https://calls-dev.wasaachat.com';

interface CallInitiation {
  participantIds: string[];
  callType: 'voice' | 'video';
  isGroupCall: boolean;
  callerId: string;
}

interface CallParticipant {
  id: string;
  name: string;
  avatar?: string;
  status: 'connecting' | 'connected' | 'disconnected';
  isMuted: boolean;
  isVideoEnabled: boolean;
}

interface SocketCallData {
  callId: string;
  callType?: 'voice' | 'video';
  callerId?: string;
  callerName?: string;
  callerAvatar?: string;
  participants?: CallParticipant[];
  isGroupCall?: boolean;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  senderId?: string;
  candidate?: RTCIceCandidateInit;
  participantId?: string;
  participant?: CallParticipant;
  participantName?: string;
  isMuted?: boolean;
  isVideoEnabled?: boolean;
}

class CallSocketService {
  private socket: Socket | null = null;
  private isConnecting = false;
  private onLog: (message: string) => void = console.log;
  private currentToken: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  setLogger(onLog: (message: string) => void) {
    this.onLog = onLog;
  }

  async connect(token: string): Promise<void> {
    if (this.isConnecting || (this.socket?.connected && this.currentToken === token)) {
      this.onLog('🔌 Already connected or connecting');
      return;
    }
    
    if (this.socket && this.currentToken !== token) {
      this.onLog('🔄 Token changed, reconnecting...');
      this.disconnect();
    }
    
    this.isConnecting = true;
    this.currentToken = token;
    
    try {
      this.onLog(`🔌 Connecting to call socket... (attempt ${this.reconnectAttempts + 1})`);
      
      // CRITICAL FIX: Enhanced socket configuration for stability
      this.socket = io(SOCKET_URL, {
        auth: { token: token.startsWith('Bearer ') ? token : `Bearer ${token}` },
        transports: ["polling"],  // ✅ ONLY POLLING
        upgrade: false,           // ✅ NO UPGRADE
        timeout: 10000,           // ✅ TIMEOUT SETTING
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        // reconnectionDelayMax: 5000, // Not needed for polling config
        forceNew: true,
        autoConnect: true,
      });
      
      this.setupEventListeners();
      
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout after 30 seconds'));
        }, 30000);
        
        this.socket!.on('connect', () => {
          clearTimeout(timeout);
          this.onLog('✅ Call socket connected successfully');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          useCallStore.getState().setConnected(true);
          resolve();
        });
        
        this.socket!.on('connect_error', (error) => {
          clearTimeout(timeout);
          this.onLog(`❌ Connection failed: ${error.message}`);
          this.isConnecting = false;
          this.reconnectAttempts++;
          useCallStore.getState().setConnected(false);
          reject(error);
        });
      });
    } catch (error) {
      this.isConnecting = false;
      useCallStore.getState().setConnected(false);
      throw error;
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;
    
    this.socket.on('disconnect', (reason) => {
      this.onLog(`❌ Call socket disconnected: ${reason}`);
      this.isConnecting = false;
      useCallStore.getState().setConnected(false);
      
      // Auto-reconnect for certain disconnect reasons
      if (reason === 'io server disconnect' || reason === 'transport close') {
        this.onLog('🔄 Attempting auto-reconnect...');
        setTimeout(() => {
          if (this.currentToken && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.connect(this.currentToken);
          }
        }, 2000);
      }
    });
    
    this.socket.on('connect_error', (error) => {
      this.onLog(`🚨 Call socket connection error: ${error.message}`);
      this.isConnecting = false;
      useCallStore.getState().setConnected(false);
      useCallStore.getState().setConnectionError(error.message);
    });
    
    // CRITICAL FIX: Enhanced call offer handling
    this.socket.on('call-offer', (data: SocketCallData) => {
      this.onLog(`📞 Call offer received: callId=${data.callId}, callType=${data.callType}, hasOffer=${!!data.offer}`);
      this.handleIncomingCall(data);
    });
    
    // CRITICAL FIX: Enhanced call answer handling
    this.socket.on('call-answer', (data: SocketCallData) => {
      this.onLog(`📞 Call answer received: callId=${data.callId}, senderId=${data.senderId}, hasAnswer=${!!data.answer}`);
      this.handleCallAccepted();
    });
    
    this.socket.on('ice-candidate', (data: SocketCallData) => {
      this.onLog(`🧊 ICE candidate received: callId=${data.callId}, senderId=${data.senderId}, hasCandidate=${!!data.candidate}`);
      // Forward to useCall for processing
    });
    
    this.socket.on('call-ended', () => {
      this.onLog(`📞 Call ended`);
      useCallStore.getState().endCall();
    });
    
    this.socket.on('call-rejected', () => {
      this.onLog(`❌ Call rejected`);
      useCallStore.getState().endCall();
    });
    
    this.socket.on('participant-joined', (data: SocketCallData) => {
      this.onLog(`👤 Participant joined: callId=${data.callId}, participantId=${data.participant?.id}`);
      this.handleParticipantJoined(data);
    });
    
    this.socket.on('participant-left', (data: SocketCallData) => {
      this.onLog(`👤 Participant left: callId=${data.callId}, participantId=${data.participantId}`);
      this.handleParticipantLeft(data);
    });
    
    this.socket.on('mute-status-changed', (data: SocketCallData) => {
      this.onLog(`🎤 Mute status changed: callId=${data.callId}, participantId=${data.participantId}, isMuted=${data.isMuted}`);
      this.handleMuteStatusChanged(data);
    });
    
    this.socket.on('video-status-changed', (data: SocketCallData) => {
      this.onLog(`📹 Video status changed: callId=${data.callId}, participantId=${data.participantId}, isVideoEnabled=${data.isVideoEnabled}`);
      this.handleVideoStatusChanged(data);
    });
    
    this.socket.on('hand-raised', () => {
      this.onLog(`✋ Hand raised event received`);
      this.handleHandRaised();
    });
  }

  private handleIncomingCall(data: SocketCallData): void {
    const callStore = useCallStore.getState();
    
    // CRITICAL FIX: Proper incoming call setup with media states
    callStore.setCurrentCall({
      id: data.callId,
      type: 'incoming',
      callType: data.callType || 'voice',
      participants: data.participants || [
        {
          id: data.callerId || 'unknown',
          name: data.callerName || 'Unknown Caller',
          avatar: data.callerAvatar,
          status: 'connecting',
          isMuted: false, // Both audio and video enabled for incoming calls
          isVideoEnabled: data.callType === 'video',
        },
      ],
      startTime: new Date(),
      status: 'ringing',
      isGroupCall: data.isGroupCall || false,
    });
    
    callStore.setIsInCall(false);
    callStore.setIsConnecting(false);
    this.onLog(`✅ Incoming ${data.callType} call setup complete`);
  }

  private handleCallAccepted(): void {
    const callStore = useCallStore.getState();
    callStore.setIsInCall(true);
    callStore.setIsConnecting(false);
    
    if (callStore.currentCall) {
      callStore.setCurrentCall({
        ...callStore.currentCall,
        status: 'connected',
      });
    }
    this.onLog('✅ Call accepted and connected');
  }

  private handleParticipantJoined(data: SocketCallData): void {
    const callStore = useCallStore.getState();
    if (callStore.currentCall && data.participant) {
      const updatedParticipants = [...callStore.currentCall.participants];
      const existingIndex = updatedParticipants.findIndex(p => p.id === data.participant!.id);
      
      if (existingIndex >= 0) {
        updatedParticipants[existingIndex] = { 
          ...updatedParticipants[existingIndex], 
          ...data.participant 
        };
      } else {
        updatedParticipants.push(data.participant);
      }
      
      callStore.setCurrentCall({
        ...callStore.currentCall,
        participants: updatedParticipants,
      });
    }
  }

  private handleParticipantLeft(data: SocketCallData): void {
    const callStore = useCallStore.getState();
    if (callStore.currentCall && data.participantId) {
      const updatedParticipants = callStore.currentCall.participants.filter(
        p => p.id !== data.participantId
      );
      callStore.setCurrentCall({
        ...callStore.currentCall,
        participants: updatedParticipants,
      });
    }
  }

  private handleMuteStatusChanged(data: SocketCallData): void {
    const callStore = useCallStore.getState();
    if (callStore.currentCall && data.participantId !== undefined && data.isMuted !== undefined) {
      const updatedParticipants = callStore.currentCall.participants.map(p =>
        p.id === data.participantId ? { ...p, isMuted: data.isMuted! } : p
      );
      callStore.setCurrentCall({
        ...callStore.currentCall,
        participants: updatedParticipants,
      });
    }
  }

  private handleVideoStatusChanged(data: SocketCallData): void {
    const callStore = useCallStore.getState();
    if (callStore.currentCall && data.participantId !== undefined && data.isVideoEnabled !== undefined) {
      const updatedParticipants = callStore.currentCall.participants.map(p =>
        p.id === data.participantId ? { ...p, isVideoEnabled: data.isVideoEnabled! } : p
      );
      callStore.setCurrentCall({
        ...callStore.currentCall,
        participants: updatedParticipants,
      });
    }
  }

  private handleHandRaised(): void {
    this.onLog(`✋ Hand raised event received`);
  }

  // CRITICAL FIX: Enhanced emit with connection checking and retry
  emit(event: string, data?: unknown): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
      this.onLog(`📤 Emitted ${event}: ${JSON.stringify(data)}`);
    } else {
      this.onLog(`⚠️ Cannot emit ${event} - socket not connected`);
      useCallStore.getState().setConnectionError(`Socket not connected for event ${event}`);
      
      // Try to reconnect if we have a token
      if (this.currentToken && !this.isConnecting) {
        this.onLog('🔄 Attempting reconnect for emit...');
        this.connect(this.currentToken);
      }
    }
  }

  async initiateCall(callData: CallInitiation): Promise<void> {
    this.onLog(`📞 Initiating call: ${JSON.stringify(callData)}`);
    this.emit('initiate-call', callData);
  }

  answerCall(): void {
    const callId = useCallStore.getState().currentCall?.id;
    if (callId) {
      this.onLog(`📞 Answering call: ${callId}`);
      this.emit('call-answer', { callId });
    }
  }

  rejectCall(): void {
    const callId = useCallStore.getState().currentCall?.id;
    if (callId) {
      this.onLog(`❌ Rejecting call: ${callId}`);
      this.emit('call-rejected', { callId });
    }
  }

  endCall(): void {
    const callId = useCallStore.getState().currentCall?.id;
    if (callId) {
      this.onLog(`📞 Ending call: ${callId}`);
      this.emit('call-ended', { callId });
    }
  }

  toggleMute(isMuted: boolean): void {
    const callId = useCallStore.getState().currentCall?.id;
    if (callId) {
      this.emit('mute-status-changed', { isMuted, callId });
    }
  }

  toggleVideo(isVideoEnabled: boolean): void {
    const callId = useCallStore.getState().currentCall?.id;
    if (callId) {
      this.emit('video-status-changed', { isVideoEnabled, callId });
    }
  }

  raiseHand(isRaised: boolean): void {
    const callId = useCallStore.getState().currentCall?.id;
    if (callId) {
      this.emit('hand-raised', { isRaised, callId });
    }
  }

  shareScreen(): void {
    const callId = useCallStore.getState().currentCall?.id;
    if (callId) {
      this.emit('share-screen', { callId });
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.onLog('🔌 Disconnecting call socket');
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.currentToken = null;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    useCallStore.getState().setConnected(false);
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  on(event: string, callback: (data: SocketCallData) => void): void {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string): void {
    if (this.socket) {
      this.socket.off(event);
    }
  }
}

export const callSocket = new CallSocketService();

export const useCallSocket = (token: string | null, onLog: (message: string) => void) => {
  const connectionAttemptRef = useRef<number>(0);

  useEffect(() => {
    callSocket.setLogger(onLog);
    
    const connectSocket = async () => {
      if (token && token.length > 10) {
        try {
          connectionAttemptRef.current++;
          onLog(`🔄 Connection attempt #${connectionAttemptRef.current}`);
          await callSocket.connect(token);
        } catch (error) {
          onLog(`❌ Connection attempt #${connectionAttemptRef.current} failed: ${error}`);
          if (connectionAttemptRef.current < 5) {
            setTimeout(() => connectSocket(), 1000 * connectionAttemptRef.current);
          }
        }
      } else {
        onLog('❌ Invalid or missing token');
        callSocket.disconnect();
      }
    };
    
    connectSocket();
    
    return () => {
      callSocket.disconnect();
    };
  }, [token, onLog]);

  return {
    socket: callSocket,
    isConnected: callSocket.isConnected(),
  };
};