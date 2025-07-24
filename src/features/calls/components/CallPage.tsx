"use client";

import React, { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  Search,
  Phone,
  Video,
  PhoneMissed,
  Loader,
  Link as LinkIcon,
  MoreHorizontal,
  Mic,
  MicOff,
  VideoOff,
  PhoneOff,
  Hand,
  Monitor,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useChatStore } from "@/store/chatStore";
import { useCallStore } from "@/store/callStore";
import { useCallSocket } from "@/store/callSocket";
import { io, Socket } from "socket.io-client";
import { useNotification } from "./NotificationContext";
import SidebarNav from "@/components/SidebarNav";

interface CallHistoryItem {
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

interface Room {
  id: string;
  name: string;
  description: string;
  participantCount: number;
  maxParticipants: number;
}

const API_BASE_URL = "https://calls-dev.wasaachat.com";
socket = io('https://calls-dev.wasaachat.com', {  // ✅ HTTPS = HTTP polling
const API_KEY =
  "QgR1v+o16jphR9AMSJ9Qf8SnOqmMd4HPziLZvMU1Mt0t7ocaT38q/8AsuOII2YxM60WaXQMkFIYv2bqo+pS/sw==";

const Call: React.FC = () => {
  const pathname = usePathname();
  const { user, isAuthenticated, accessToken } = useAuthStore();
  const { contacts, getContactName, getContactAvatar } = useChatStore();
  const {
    callHistory,
    isLoadingHistory,
    currentTab,
    showDialPad,
    showNewCallModal,
    isConnected,
    currentCall,
    isInCall,
    isConnecting,
    localStream,
    isMuted,
    isVideoEnabled,
    handRaised,
    showAcceptButton,
    setCurrentTab,
    setShowDialPad,
    setShowNewCallModal,
    fetchCallHistory,
    startCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleHandRaise,
    shareScreen,
  } = useCallStore();

  const { addNotification } = useNotification();
  const [searchQuery, setSearchQuery] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [isGroupCall, setIsGroupCall] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomDescription, setRoomDescription] = useState("");
  const [inviteDevs, setInviteDevs] = useState<string[]>([]);
  const [maxParticipants, setMaxParticipants] = useState(8);
  const [audioOnlyRoom, setAudioOnlyRoom] = useState(false);
  const [publicRoom, setPublicRoom] = useState(false);
  const [participants, setParticipants] = useState<string[]>([]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());

  // Socket connection with logging
  const logDebug = (message: string) => {
    console.log(message);
    setLogs((prev) => [
      ...prev.slice(-20),
      `[${new Date().toLocaleTimeString()}] ${message}`,
    ]);
  };

  // Initialize socket connection
  useEffect(() => {
    if (isAuthenticated && user?.id && accessToken) {
      logDebug("Initializing socket...");
      // This is CORRECT (copy from your working HTML):
socketRef.current = io("https://calls-dev.wasaachat.com", {
  auth: { token: accessToken },
  transports: ["polling"],  // ✅ ONLY POLLING
  upgrade: false,           // ✅ NO UPGRADE
  timeout: 10000,           // ✅ TIMEOUT SETTING
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

      socketRef.current.on("connect", () => {
        logDebug(`Socket connected: ${socketRef.current?.id}`);
        setCurrentTab("missed");
        joinUserRoom();
      });

      socketRef.current.on("connect_error", (error) => {
        logDebug(`Socket error: ${error.message}`);
        addNotification(`Connection error: ${error.message}`, "error");
      });

      socketRef.current.on("call-offer", async (data) => {
        const { callId, callerId, offer, callType } = data;
        logDebug(`Call offer received: ${callId} from ${callerId}`);
        setCurrentRoomId(callId);
        setIsGroupCall(false);
        const callerName = getContactName(callerId, user?.id) || "Unknown";
        setCurrentUser(callerName);

        await useCallStore.getState().setCurrentCall({
          id: callId,
          type: "incoming",
          callType,
          participants: [
            {
              id: callerId,
              name: callerName,
              status: "connecting",
              isMuted: false,
              isVideoEnabled: callType === "video",
            },
          ],
          startTime: new Date(),
          status: "ringing",
          isGroupCall: false,
        });

        addNotification(
          `Incoming ${callType} Call from ${callerName}`,
          "info",
          true
        );
      });

      socketRef.current.on("room-invite-notification", (data) => {
        logDebug(`Room invite notification received: ${JSON.stringify(data)}`);
        if (data.targetId === user?.id) {
          setCurrentRoomId(data.roomId);
          setIsGroupCall(true);
          addNotification(
            `Group Call Started: ${data.roomName}`,
            `${data.hostName} started "${data.roomName}". Click Accept to join!`,
            true
          );
          window.pendingRoomInvite = data;
        }
      });

      socketRef.current.on("webrtc-offer", async (data) => {
        if (data.targetId === user?.id && data.roomId === currentRoomId) {
          logDebug(`Received webrtc-offer from ${data.senderId}`);
          await handleWebRTCOffer(data);
        }
      });

      socketRef.current.on("webrtc-answer", async (data) => {
        if (data.targetId === user?.id && data.roomId === currentRoomId) {
          logDebug(`Received webrtc-answer from ${data.senderId}`);
          await handleWebRTCAnswer(data);
        }
      });

      socketRef.current.on("webrtc-ice-candidate", async (data) => {
        if (data.targetId === user?.id && data.roomId === currentRoomId) {
          logDebug(`Processing ICE candidate from ${data.senderId}`);
          await handleWebRTCIceCandidate(data);
        }
      });

      socketRef.current.on("room-join-accepted", (data) => {
        if (data.roomId === currentRoomId && data.userId !== user?.id) {
          logDebug(`${data.userName} joined the room`);
          setParticipants((prev) => [...prev, data.userId]);
          addNotification(`${data.userName} joined the call`, "success");
        }
      });

      socketRef.current.on("room-participant-left", (data) => {
        if (data.roomId === currentRoomId) {
          logDebug(`${data.userName} left the room`);
          peerConnections.current.get(data.userId)?.close();
          peerConnections.current.delete(data.userId);
          setParticipants((prev) => prev.filter((id) => id !== data.userId));
          addNotification(`${data.userName} left the call`, "info");
        }
      });

      return () => {
        socketRef.current?.disconnect();
      };
    }
  }, [isAuthenticated, user?.id, accessToken]);

  // Setup local video stream
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.muted = true;
    }
  }, [localStream]);

  const formatCallTime = (timestamp: Date) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 86400000) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return date.toLocaleDateString();
  };

  const handleWebRTCOffer = async (data: any) => {
    try {
      const senderName = getContactName(data.senderId, user?.id) || "Unknown";
      let pc = peerConnections.current.get(data.senderId);
      if (!pc) {
        pc = new RTCPeerConnection({
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
          ],
        });
        if (localStream) {
          localStream
            .getTracks()
            .forEach((track) => pc.addTrack(track, localStream));
        }
        pc.ontrack = (event) => {
          const remoteStream = event.streams[0];
          if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
          }
        };
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socketRef.current?.emit("webrtc-ice-candidate", {
              roomId: currentRoomId,
              targetId: data.senderId,
              senderId: user?.id,
              candidate: event.candidate,
            });
          }
        };
        peerConnections.current.set(data.senderId, pc);
      }
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current?.emit("webrtc-answer", {
        roomId: currentRoomId,
        targetId: data.senderId,
        senderId: user?.id,
        answer,
      });
    } catch (error) {
      logDebug(`Error handling WebRTC offer: ${error}`);
      addNotification(`Failed to handle offer: ${error}`, "error");
    }
  };

  const handleWebRTCAnswer = async (data: any) => {
    try {
      const pc = peerConnections.current.get(data.senderId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        logDebug(`WebRTC connection established with ${data.senderId}`);
      }
    } catch (error) {
      logDebug(`Error handling WebRTC answer: ${error}`);
    }
  };

  const handleWebRTCIceCandidate = async (data: any) => {
    try {
      const pc = peerConnections.current.get(data.senderId);
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    } catch (error) {
      logDebug(`Error handling ICE candidate: ${error}`);
    }
  };

  const handleCallContact = async (
    contactId: string,
    callType: "voice" | "video"
  ) => {
    try {
      await startCall(contactId, callType);
      addNotification(`Starting ${callType} call...`, "info");
    } catch (error) {
      logDebug(`Failed to start call: ${error}`);
      addNotification("Failed to start call", "error");
    }
  };

  const handleRetryCall = async (historyItem: CallHistoryItem) => {
    try {
      await startCall(historyItem.participantId, historyItem.callType);
      addNotification("Retrying call...", "info");
    } catch (error) {
      logDebug(`Failed to retry call: ${error}`);
      addNotification("Failed to retry call", "error");
    }
  };

  const handleAnswerCall = async () => {
    try {
      await answerCall();
      addNotification("Call answered", "success");
    } catch (error) {
      logDebug(`Failed to answer call: ${error}`);
      addNotification("Failed to answer call", "error");
    }
  };

  const handleRejectCall = () => {
    rejectCall();
    addNotification("Call rejected", "info");
  };

  const handleEndCall = () => {
    endCall();
    addNotification("Call ended", "info");
    setCurrentRoomId(null);
    setIsGroupCall(false);
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
  };

  const handleShareScreen = async () => {
    try {
      await shareScreen();
      addNotification("Screen sharing started", "success");
    } catch (error) {
      logDebug(`Failed to share screen: ${error}`);
      addNotification("Failed to share screen", "error");
    }
  };

  const createGroupRoom = async () => {
    if (!roomName) {
      addNotification("Enter room name", "error");
      return;
    }
    try {
      const roomId = `room-${Date.now()}`;
      setCurrentRoomId(roomId);
      setIsGroupCall(true);
      socketRef.current?.emit("join-room", {
        roomId,
        userId: user?.id,
        userName: user?.name || "Unknown",
      });
      inviteDevs.forEach((targetId) => {
        socketRef.current?.emit("room-invite-notification", {
          targetId,
          roomId,
          roomName,
          hostName: user?.name || "Unknown",
          hostId: user?.id,
          type: "group-call-invite",
        });
      });
      setParticipants([user?.id || ""]);
      addNotification(`Room "${roomName}" created successfully`, "success");
      await useCallStore
        .getState()
        .startGroupCall(inviteDevs, audioOnlyRoom ? "voice" : "video");
    } catch (error) {
      logDebug(`Error creating room: ${error}`);
      addNotification(`Failed to create room: ${error}`, "error");
    }
  };

  const joinUserRoom = () => {
    if (!socketRef.current?.connected) {
      addNotification("Socket not connected", "error");
      return;
    }
    const roomId = `user:${user?.id}`;
    logDebug(`Joining room: ${roomId}`);
    socketRef.current?.emit("join-room", { roomId, userId: user?.id });
  };

  const filteredCallHistory = callHistory.filter((call) => {
    if (currentTab === "missed") return call.status === "missed";
    if (currentTab === "pending")
      return call.status === "completed" && call.type === "outgoing";
    if (currentTab === "requests") return call.type === "incoming";
    return true;
  });

  const filteredContacts = contacts.filter((contact) =>
    getContactName(contact.contact_id, user?.id)
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  if (isInCall || currentCall) {
    return (
      <div className="h-screen bg-black flex flex-col">
        <div className="p-4 text-white text-center">
          <h2 className="text-xl font-semibold">
            {isGroupCall
              ? `Room: ${currentRoomId}`
              : currentCall?.participants[0]?.name || "Unknown"}
          </h2>
          <p className="text-sm opacity-75">
            {currentCall?.status === "connecting"
              ? "Connecting..."
              : "Connected"}
          </p>
        </div>
        <div className="flex-1 relative">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute top-4 right-4 w-32 h-24 bg-gray-800 rounded-lg overflow-hidden">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>
          {handRaised && (
            <div className="absolute top-4 left-4 bg-yellow-500 text-black px-3 py-1 rounded-full text-sm font-medium">
              ✋ Hand Raised
            </div>
          )}
        </div>
        <div className="p-6 bg-gray-900">
          <div className="flex justify-center space-x-4">
            <button
              onClick={toggleMute}
              className={`p-4 rounded-full ${
                isMuted ? "bg-red-500" : "bg-gray-700"
              } text-white hover:opacity-80 transition-opacity`}
            >
              {isMuted ? (
                <MicOff className="w-6 h-6" />
              ) : (
                <Mic className="w-6 h-6" />
              )}
            </button>
            <button
              onClick={toggleVideo}
              className={`p-4 rounded-full ${
                !isVideoEnabled ? "bg-red-500" : "bg-gray-700"
              } text-white hover:opacity-80 transition-opacity`}
            >
              {isVideoEnabled ? (
                <Video className="w-6 h-6" />
              ) : (
                <VideoOff className="w-6 h-6" />
              )}
            </button>
            <button
              onClick={handleShareScreen}
              className="p-4 rounded-full bg-gray-700 text-white hover:opacity-80 transition-opacity"
            >
              <Monitor className="w-6 h-6" />
            </button>
            <button
              onClick={toggleHandRaise}
              className={`p-4 rounded-full ${
                handRaised ? "bg-yellow-500" : "bg-gray-700"
              } text-white hover:opacity-80 transition-opacity`}
            >
              <Hand className="w-6 h-6" />
            </button>
            <button
              onClick={handleEndCall}
              className="p-4 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
          </div>
        </div>
        {showAcceptButton && (
          <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 flex space-x-4">
            <button
              onClick={handleRejectCall}
              className="p-4 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              <PhoneOff className="w-8 h-8" />
            </button>
            <button
              onClick={handleAnswerCall}
              className="p-4 rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors"
            >
              <Phone className="w-8 h-8" />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-screen bg-white flex">
      <SidebarNav onClose={() => {}} currentPath={pathname} />
      <div className="flex-1 ml-20">
        <div className="w-96 flex flex-col bg-white border-r border-gray-200">
          <div className="p-4 border-b border-gray-100">
            <h1 className="text-2xl font-semibold text-gray-900 mb-4">
              WASAA Video Call
            </h1>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-100 text-black border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setCurrentTab("one-on-one")}
                className={`px-4 py-2 rounded-full text-xs font-medium transition-colors ${
                  currentTab === "one-on-one"
                    ? "bg-blue-500 text-white"
                    : "text-gray-600 border border-blue-500 hover:bg-gray-100"
                }`}
              >
                📞 1:1 Calls
              </button>
              <button
                onClick={() => setCurrentTab("group-calls")}
                className={`px-4 py-2 rounded-full text-xs font-medium transition-colors ${
                  currentTab === "group-calls"
                    ? "bg-blue-500 text-white"
                    : "text-gray-600 border border-blue-500 hover:bg-gray-100"
                }`}
              >
                👥 Group Calls
              </button>
            </div>
          </div>
          {currentTab === "one-on-one" && (
            <div className="flex-1 overflow-y-auto">
              <div className="px-4 py-4">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  All Contacts
                </h2>
                {filteredContacts.length > 0 ? (
                  <div className="space-y-2">
                    {filteredContacts.map((contact) => {
                      const contactName = getContactName(
                        contact.contact_id,
                        user?.id
                      );
                      const contactAvatar = getContactAvatar(
                        contact.contact_id
                      );
                      return (
                        <div
                          key={contact.contact_id}
                          className="flex items-center space-x-3 py-3 hover:bg-gray-50 rounded-lg px-2"
                        >
                          <div className="relative">
                            {contactAvatar ? (
                              <Image
                                src={contactAvatar}
                                alt={contactName}
                                width={48}
                                height={48}
                                className="w-12 h-12 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-gray-500 flex items-center justify-center text-white font-semibold">
                                {contactName.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-900 text-sm truncate">
                              {contactName}
                            </h3>
                            <p className="text-xs text-gray-500 truncate">
                              Available
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() =>
                                handleCallContact(contact.contact_id, "voice")
                              }
                              className="p-2 text-green-500 hover:bg-green-50 rounded-full transition-colors"
                              title="Voice Call"
                              disabled={isConnecting}
                            >
                              <Phone className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                handleCallContact(contact.contact_id, "video")
                              }
                              className="p-2 text-blue-500 hover:bg-blue-50 rounded-full transition-colors"
                              title="Video Call"
                              disabled={isConnecting}
                            >
                              <Video className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-2xl mb-2">👥</div>
                    <p className="text-sm">No contacts found</p>
                  </div>
                )}
              </div>
            </div>
          )}
          {currentTab === "group-calls" && (
            <div className="flex-1 overflow-y-auto">
              <div className="p-4">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  Create Group Call Room
                </h2>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Room Name
                  </label>
                  <input
                    type="text"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="e.g., Daily Standup"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Description (optional)
                  </label>
                  <textarea
                    value={roomDescription}
                    onChange={(e) => setRoomDescription(e.target.value)}
                    placeholder="Meeting purpose"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Invite Contacts
                  </label>
                  <select
                    multiple
                    value={inviteDevs}
                    onChange={(e) =>
                      setInviteDevs(
                        Array.from(
                          e.target.selectedOptions,
                          (option) => option.value
                        )
                      )
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    {contacts.map((contact) => (
                      <option
                        key={contact.contact_id}
                        value={contact.contact_id}
                      >
                        {getContactName(contact.contact_id, user?.id)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Max Participants
                  </label>
                  <select
                    value={maxParticipants}
                    onChange={(e) =>
                      setMaxParticipants(parseInt(e.target.value))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="4">4</option>
                    <option value="8">8</option>
                    <option value="12">12</option>
                    <option value="16">16</option>
                  </select>
                </div>
                <div className="flex items-center mb-4">
                  <input
                    type="checkbox"
                    checked={audioOnlyRoom}
                    onChange={(e) => setAudioOnlyRoom(e.target.checked)}
                    className="mr-2"
                  />
                  <label className="text-sm font-medium text-gray-700">
                    Audio Only
                  </label>
                </div>
                <div className="flex items-center mb-4">
                  <input
                    type="checkbox"
                    checked={publicRoom}
                    onChange={(e) => setPublicRoom(e.target.checked)}
                    className="mr-2"
                  />
                  <label className="text-sm font-medium text-gray-700">
                    Public Room
                  </label>
                </div>
                <button
                  onClick={createGroupRoom}
                  className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  Create & Join Room
                </button>
              </div>
              <div className="p-4">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  Available Rooms
                </h2>
                {rooms.length > 0 ? (
                  rooms.map((room) => (
                    <div
                      key={room.id}
                      className="p-2 border border-gray-200 rounded-lg mb-2"
                    >
                      <p>
                        <strong>{room.name}</strong> (ID: {room.id})
                      </p>
                      <p>{room.description}</p>
                      <p>
                        Participants: {room.participantCount}/
                        {room.maxParticipants}
                      </p>
                      <button
                        onClick={() => {
                          /* Join room logic */
                        }}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg"
                      >
                        Join
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500">No rooms available</p>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 flex flex-col bg-gray-50">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="flex space-x-8 mb-8">
                <button
                  onClick={() => setShowNewCallModal(true)}
                  className="flex flex-col items-center space-y-2 p-6 hover:shadow-xl transition-shadow"
                >
                  <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
                    <LinkIcon className="w-8 h-8 text-gray-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">
                    New call link
                  </span>
                </button>
                <button
                  onClick={() => setShowDialPad(true)}
                  className="flex flex-col items-center space-y-2 p-6 hover:shadow-xl transition-shadow"
                >
                  <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
                    <MoreHorizontal className="w-8 h-8 text-gray-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">
                    Dial a number
                  </span>
                </button>
              </div>
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-500 mb-4">
                <div
                  className={`w-2 h-2 rounded-full ${
                    isConnected ? "bg-green-500" : "bg-red-500"
                  }`}
                />
                <span>{isConnected ? "Connected" : "Disconnected"}</span>
                {socketRef.current?.connected && (
                  <span className="text-xs">(Socket: Connected)</span>
                )}
              </div>
              {isConnecting && (
                <div className="flex items-center justify-center space-x-2 text-blue-500">
                  <Loader className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Connecting call...</span>
                </div>
              )}
            </div>
          </div>
          <div className="h-48 border-t border-gray-200 bg-white p-4 overflow-y-auto">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Connection Logs
            </h3>
            <div className="text-xs text-gray-600 space-y-1">
              {logs.slice(-10).map((log, index) => (
                <div key={index} className="font-mono">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {showNewCallModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Create New Call Link</h3>
            <p className="text-gray-600 mb-4">
              Generate a link that others can use to join your call.
            </p>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowNewCallModal(false)}
                className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                Generate Link
              </button>
            </div>
          </div>
        </div>
      )}
      {showDialPad && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-80">
            <h3 className="text-lg font-semibold mb-4">Dial a Number</h3>
            <input
              type="tel"
              placeholder="Enter phone number"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex space-x-2">
              <button
                onClick={() => setShowDialPad(false)}
                className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600">
                Call
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Call;
