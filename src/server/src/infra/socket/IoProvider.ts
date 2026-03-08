/**
 * IoProvider — Socket.IO singleton registry
 * ──────────────────────────────────────────────────────────────────────────
 * Eliminates the need to thread the `io` instance through every module
 * constructor chain. Modules that need to emit events can call `getIo()`
 * directly instead of requiring `io` to be injected via their factory.
 *
 * Usage:
 *   // In app bootstrap (app.ts) — called once after SocketManager is created:
 *   import { setIo } from "@/infra/socket/IoProvider";
 *   setIo(socketManager.getIO());
 *
 *   // In any module that needs to emit an event:
 *   import { getIo } from "@/infra/socket/IoProvider";
 *   getIo().to("admin").emit("orderPlaced", payload);
 */
import { Server as SocketIOServer } from "socket.io";

let _io: SocketIOServer | null = null;

/**
 * Register the Socket.IO server instance.
 * Must be called exactly once during application bootstrap, before any route
 * handler that may call getIo().
 */
export const setIo = (io: SocketIOServer): void => {
  if (_io !== null) {
    // Warn on double-init (e.g. in tests) rather than silently replacing.
    console.warn("[IoProvider] Socket.IO instance already registered — overwriting.");
  }
  _io = io;
};

/**
 * Retrieve the registered Socket.IO server instance.
 * Throws if called before setIo() has been called.
 */
export const getIo = (): SocketIOServer => {
  if (_io === null) {
    throw new Error(
      "[IoProvider] Socket.IO instance not initialized. Call setIo() during app bootstrap."
    );
  }
  return _io;
};

/**
 * Reset the registry (test teardown only).
 */
export const resetIo = (): void => {
  _io = null;
};
