import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { API_BASE_URL } from "@/app/lib/constants/config";

const SOCKET_URL = API_BASE_URL.replace(/\/api\/v\d+\/?$/, "");

export const useSocketConnection = (chatId: string) => {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io(SOCKET_URL);

    // Join specific chat room
    socketRef.current.emit("joinChat", chatId);

    // Clean up on component unmount
    return () => {
      socketRef.current?.disconnect();
    };
  }, [chatId]);

  return socketRef.current;
};
