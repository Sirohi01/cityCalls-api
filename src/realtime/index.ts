import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { verifyAccessToken } from '../lib/jwt';
import { env } from '../config/env';

// Rooms and events per docs/08-system-architecture.md §4. Real-time is required
// from day one, not deferred — this module is wired in server.ts at boot.
let io: SocketIOServer | undefined;

export function initRealtime(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: env.corsAllowedOrigins, credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('Missing auth token'));
    try {
      const payload = verifyAccessToken(token);
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    socket.join(`user:${user.sub}:notifications`);
    if (user.branchId) socket.join(`branch:${user.branchId}:dashboard`);
  });

  return io;
}

export function getIo(): SocketIOServer {
  if (!io) throw new Error('Socket.IO not initialized — call initRealtime() first');
  return io;
}

// Helpers for domain modules to emit without importing socket.io directly.
export function emitServiceRequestStatusChanged(serviceRequestId: string, payload: unknown): void {
  getIo().to(`service-request:${serviceRequestId}`).emit('service-request.status-changed', payload);
}

export function emitServiceRequestAssigned(serviceRequestId: string, payload: unknown): void {
  getIo().to(`service-request:${serviceRequestId}`).emit('service-request.assigned', payload);
}

export function emitTechnicianLocationUpdated(serviceRequestId: string, payload: unknown): void {
  getIo().to(`service-request:${serviceRequestId}`).emit('technician.location-updated', payload);
}

export function emitNotificationNew(userId: string, payload: unknown): void {
  getIo().to(`user:${userId}:notifications`).emit('notification.new', payload);
}
