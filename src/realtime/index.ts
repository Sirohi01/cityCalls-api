import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { verifyAccessToken } from '../lib/jwt';
import { env } from '../config/env';
import { isCustomerRole, resolveOwnCustomerId } from '../lib/ownCustomerScope';
import { ServiceRequestModel } from '../modules/service-requests/serviceRequests.model';

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

    // Per-request rooms (service-request.status-changed, .assigned,
    // technician.location-updated) aren't auto-joined at connection — a
    // client only cares about specific requests it's viewing. Mirrors
    // assertOwnServiceRequestAccess's REST-side check: a CUSTOMER/
    // BUSINESS_CUSTOMER caller may only join a room for their own Service
    // Request; other roles (staff/technician) aren't scoped here yet, same
    // gap as the REST side for those roles.
    socket.on('service-request:join', async (serviceRequestId: unknown, ack?: (ok: boolean) => void) => {
      try {
        if (typeof serviceRequestId !== 'string' || !serviceRequestId) return ack?.(false);
        if (isCustomerRole(user.role)) {
          const sr = await ServiceRequestModel.findById(serviceRequestId).select('customerId');
          const ownCustomerId = await resolveOwnCustomerId(user.sub);
          if (!sr || !ownCustomerId || sr.customerId.toString() !== ownCustomerId) {
            return ack?.(false);
          }
        }
        socket.join(`service-request:${serviceRequestId}`);
        ack?.(true);
      } catch {
        ack?.(false);
      }
    });

    socket.on('service-request:leave', (serviceRequestId: unknown) => {
      if (typeof serviceRequestId === 'string' && serviceRequestId) {
        socket.leave(`service-request:${serviceRequestId}`);
      }
    });
  });

  return io;
}

// Emitting a real-time event is best-effort, same as every other optional
// integration in this codebase (docs/14-integration-architecture.md) — a
// missing/uninitialized Socket.IO server (not yet booted, a background-job or
// test context with no HTTP server attached, a future worker-process split)
// must never crash the business operation that triggered the emit. Every
// emit*() helper below goes through this guard instead of throwing.
function emit(room: string, event: string, payload: unknown): void {
  if (!io) {
    console.warn(`[realtime] skipped emit '${event}' to '${room}' — Socket.IO not initialized`);
    return;
  }
  io.to(room).emit(event, payload);
}

export function emitServiceRequestStatusChanged(serviceRequestId: string, payload: unknown): void {
  emit(`service-request:${serviceRequestId}`, 'service-request.status-changed', payload);
}

export function emitServiceRequestAssigned(serviceRequestId: string, payload: unknown): void {
  emit(`service-request:${serviceRequestId}`, 'service-request.assigned', payload);
}

export function emitTechnicianLocationUpdated(serviceRequestId: string, payload: unknown): void {
  emit(`service-request:${serviceRequestId}`, 'technician.location-updated', payload);
}

export function emitNotificationNew(userId: string, payload: unknown): void {
  emit(`user:${userId}:notifications`, 'notification.new', payload);
}
