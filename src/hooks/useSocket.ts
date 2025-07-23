// src/hooks/useSocket.ts - Fixed to prevent infinite loops
import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'https://calls-dev.wasaachat.com';

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  reconnect: () => void;
}

export const useSocket = (
  token: string | null, 
  onLog: (message: string) => void
): UseSocketReturn => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = useRef(5);
  const tokenRef = useRef(token);
  
  // Update token ref when token changes
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  // Stable cleanup function that doesn't depend on socket state
  const cleanup = useCallback(() => {
    setSocket(prevSocket => {
      if (prevSocket) {
        onLog('🔌 Cleaning up socket connection');
        prevSocket.removeAllListeners();
        prevSocket.disconnect();
        setIsConnected(false);
      }
      return null;
    });
  }, [onLog]);

  // Connect function with stable dependencies
  const connect = useCallback(() => {
    const currentToken = tokenRef.current;
    
    if (!currentToken) {
      onLog('❌ No token provided, skipping socket connection');
      return;
    }

    // Clean up any existing connection first
    cleanup();

    onLog('🔌 Connecting to socket with token...');
    
    const newSocket = io(SOCKET_URL, {
      auth: { token: currentToken },
      transports: ["polling"],  // ✅ ONLY POLLING
      upgrade: false,           // ✅ NO UPGRADE
      timeout: 10000,           // ✅ TIMEOUT SETTING
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // Connection event handlers
    newSocket.on('connect', () => {
      onLog('✅ Socket connected successfully');
      setIsConnected(true);
      reconnectAttempts.current = 0;
    });

    newSocket.on('disconnect', (reason) => {
      onLog(`❌ Socket disconnected: ${reason}`);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      onLog(`🚨 Socket connection error: ${error.message}`);
      setIsConnected(false);
      
      if (reconnectAttempts.current < maxReconnectAttempts.current) {
        reconnectAttempts.current++;
        onLog(`🔄 Retrying connection (${reconnectAttempts.current}/${maxReconnectAttempts.current})...`);
      } else {
        onLog('❌ Max reconnection attempts reached');
      }
    });

    setSocket(newSocket);
  }, [onLog, cleanup]);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    onLog('🔄 Manual reconnection triggered');
    reconnectAttempts.current = 0;
    connect();
  }, [connect, onLog]);

  // Main effect - only runs when token changes
  useEffect(() => {
    if (token) {
      connect();
    } else {
      cleanup();
    }

    // Cleanup on unmount
    return cleanup;
  }, [token, connect, cleanup]);

  return {
    socket,
    isConnected,
    reconnect
  };
};