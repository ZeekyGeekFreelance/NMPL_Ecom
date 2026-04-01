import { useEffect, useState, useRef, useCallback } from "react";

const resolveSocketUrl = (url: string, authToken: string): string | null => {
  try {
    const socketUrl = new URL(url, window.location.origin);
    socketUrl.searchParams.set("token", authToken);
    return socketUrl.toString();
  } catch {
    return null;
  }
};

const useSocket = (
  url: string,
  reconnect: boolean = true,
  authToken?: string
) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const reconnectRef = useRef(reconnect);

  useEffect(() => {
    if (!authToken) {
      setSocket(null);
      setIsConnected(false);
      return;
    }

    const socketUrl = resolveSocketUrl(url, authToken);
    if (!socketUrl) {
      setSocket(null);
      setIsConnected(false);
      return;
    }

    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let activeSocket: WebSocket | null = null;

    const connect = () => {
      const ws = new WebSocket(socketUrl);
      activeSocket = ws;
      setSocket(ws);

      ws.onopen = () => {
        setIsConnected(true);
        console.log("WebSocket Connected");
      };

      ws.onmessage = (event) => {
        setMessages((prev) => [...prev, event.data]);
      };

      ws.onclose = () => {
        setIsConnected(false);
        console.log("WebSocket Disconnected");

        if (reconnectRef.current) {
          reconnectTimeout = setTimeout(() => {
            console.log("Reconnecting WebSocket...");
            connect();
          }, 3000);
        }
      };
    };

    connect();

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      activeSocket?.close();
    };
  }, [url, authToken]);

  const sendMessage = useCallback(
    (message: string) => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(message);
      } else {
        console.warn("WebSocket not connected.");
      }
    },
    [socket]
  );

  return { socket, isConnected, messages, sendMessage };
};

export default useSocket;
