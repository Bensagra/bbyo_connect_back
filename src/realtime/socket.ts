import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { verifyAccessToken } from "../common/tokens";
import { env } from "../config/env";
import { logger } from "../config/logger";

type AuthenticatedSocket = Socket & {
  data: {
    userId: string;
  };
};

let ioInstance: Server | null = null;
const onlineUsers = new Map<string, Set<string>>();

function markOnline(userId: string, socketId: string) {
  const sockets = onlineUsers.get(userId) ?? new Set<string>();
  sockets.add(socketId);
  onlineUsers.set(userId, sockets);
}

function markOffline(userId: string, socketId: string) {
  const sockets = onlineUsers.get(userId);
  if (!sockets) {
    return;
  }
  sockets.delete(socketId);
  if (sockets.size === 0) {
    onlineUsers.delete(userId);
  }
}

function setupSocketHandlers(socket: AuthenticatedSocket) {
  socket.join(`user:${socket.data.userId}`);
  markOnline(socket.data.userId, socket.id);
  ioInstance?.emit("presence.updated", {
    userId: socket.data.userId,
    online: true,
  });

  socket.on("conversation.join", (payload: { conversationId: string }) => {
    if (!payload?.conversationId) {
      return;
    }
    socket.join(`conversation:${payload.conversationId}`);
  });

  socket.on("typing", (payload: { conversationId: string; isTyping: boolean }) => {
    if (!payload?.conversationId) {
      return;
    }
    socket.to(`conversation:${payload.conversationId}`).emit("typing", {
      conversationId: payload.conversationId,
      userId: socket.data.userId,
      isTyping: Boolean(payload.isTyping),
      at: new Date().toISOString(),
    });
  });

  socket.on("disconnect", () => {
    markOffline(socket.data.userId, socket.id);
    ioInstance?.emit("presence.updated", {
      userId: socket.data.userId,
      online: onlineUsers.has(socket.data.userId),
    });
  });
}

export function initSocket(server: HttpServer) {
  ioInstance = new Server(server, {
    cors: {
      origin: env.corsAllowlist.length ? env.corsAllowlist : true,
      credentials: true,
    },
  });

  ioInstance.use((socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        (socket.handshake.headers.authorization as string | undefined)?.replace("Bearer ", "");

      if (!token) {
        return next(new Error("Missing auth token"));
      }

      const claims = verifyAccessToken(token);
      (socket as AuthenticatedSocket).data.userId = claims.sub;
      return next();
    } catch (_error) {
      return next(new Error("Invalid socket token"));
    }
  });

  ioInstance.on("connection", (socket) => {
    setupSocketHandlers(socket as AuthenticatedSocket);
  });

  logger.info("Socket.IO initialized");
  return ioInstance;
}

export function emitToConversation(conversationId: string, event: string, payload: unknown) {
  ioInstance?.to(`conversation:${conversationId}`).emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  ioInstance?.to(`user:${userId}`).emit(event, payload);
}

export function getOnlineUsersCount() {
  return onlineUsers.size;
}
