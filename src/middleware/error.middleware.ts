import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { AppError } from '../lib/errors';

// Per docs/18-error-handling-standards.md §4: unhandled exceptions never leak
// internal detail to the client; every response carries a requestId for log correlation (§8).
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = randomUUID();
  res.setHeader('X-Request-Id', requestId);
  (req as Request & { requestId: string }).requestId = requestId;
  next();
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    data: null,
    errors: [{ field: 'route', code: 'ROUTE_NOT_FOUND', message: 'Route not found' }],
  });
}

 
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId = (req as Request & { requestId?: string }).requestId;

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      data: null,
      errors: err.errors,
    });
    return;
  }

   
  console.error(`[error] requestId=${requestId}`, err);

  res.status(500).json({
    success: false,
    message: 'Something went wrong. Please try again.',
    data: null,
    errors: [{ field: 'general', code: 'INTERNAL_ERROR', message: 'Unexpected server error' }],
  });
}
