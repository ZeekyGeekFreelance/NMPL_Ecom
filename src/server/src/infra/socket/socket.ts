import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import { config, isAllowedOrigin } from "@/config";

const debugLog = (...args: unknown[]) => {
  if (config.isDevelopment) {
    console.log(...args);
  }
};

export class SocketManager {
  private io: SocketIOServer;

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: (origin, callback) => {
          if (isAllowedOrigin(origin)) {
            callback(null, true);
            return;
          }
          callback(new Error(`Origin not allowed by Socket CORS: ${origin}`));
        },
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    this.io.on("connection", (socket: Socket) => {
      debugLog("New client connected:", socket.id);

      // * This listens when a client joins a room
      socket.on("joinChat", (chatId: string) => {
        socket.join(`chat:${chatId}`);
        debugLog(`Client ${socket.id} joined chat:${chatId}`);
      });

      // * This listens when a client joins the admin room
      socket.on("joinAdmin", () => {
        socket.join("admin");
        debugLog(`Client ${socket.id} joined admin room`);
      });

      // * This listens when a client makes a call
      socket.on("callOffer", ({ chatId, offer }) => {
        socket
          .to(`chat:${chatId}`)
          .emit("callOffer", { offer, from: socket.id });
        debugLog(`Call offer sent for chat:${chatId} from ${socket.id}`);
      });

      // * This listens when a client answers a call
      socket.on("callAnswer", ({ chatId, answer, to }) => {
        socket.to(to).emit("callAnswer", { answer });
        debugLog(`Call answer sent to ${to} for chat:${chatId}`);
      });

      // * This listens when a client sends an ICE(interactive connection establishment) candidate => used to establish a peer connection
      /**
       * 
        When a client wants to establish a connection with a remote peer, 
        it generates multiple ICE candidates, 
        which can include: Host candidates, SRFLX (Server Reflexive) candidates, and PRFLX (Peer Reflexive) candidates. 
        These candidates are then sent to the other peer, which uses them to establish a connection.
       */
      socket.on("iceCandidate", ({ chatId, candidate, to }) => {
        socket.to(to).emit("iceCandidate", { candidate });
        debugLog(`ICE candidate sent to ${to} for chat:${chatId}`);
      });

      socket.on("endCall", ({ chatId }) => {
        socket.to(`chat:${chatId}`).emit("callEnded");
        debugLog(`Call ended for chat:${chatId}`);
      });

      socket.on("disconnect", () => {
        debugLog("Client disconnected:", socket.id);
      });
    });
  }

  getIO(): SocketIOServer {
    return this.io;
  }
}
