import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { API_BASE_URL } from "@/app/lib/constants/config";

const SOCKET_URL = API_BASE_URL.replace(/\/api\/v\d+\/?$/, "");

export const useAdminSocketEvents = (
  onChatCreated: () => void,
  onChatStatusUpdated: () => void
) => {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io(SOCKET_URL);

    // Join admin room
    socketRef.current.emit("joinAdmin");

    // Listen for admin events
    socketRef.current.on("chatCreated", () => {
      onChatCreated();
    });

    socketRef.current.on("chatStatusUpdated", () => {
      onChatStatusUpdated();
    });

    // Clean up on component unmount
    return () => {
      socketRef.current?.off("chatCreated");
      socketRef.current?.off("chatStatusUpdated");
      socketRef.current?.disconnect();
    };
  }, [onChatCreated, onChatStatusUpdated]);

  return socketRef.current;
};
