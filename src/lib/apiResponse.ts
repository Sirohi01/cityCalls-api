import { Response } from 'express';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiError {
  field: string;
  code: string;
  message: string;
}

// Standard envelope per docs/10-api-standards.md §3-4
export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Success',
  meta: PaginationMeta | null = null,
  statusCode = 200
): Response {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    meta,
    errors: null,
  });
}

export function sendError(
  res: Response,
  message: string,
  errors: ApiError[],
  statusCode = 422
): Response {
  return res.status(statusCode).json({
    success: false,
    message,
    data: null,
    errors,
  });
}

// Express types req.params[x] as `string | string[]` to account for wildcard routes;
// our routes only ever use plain `:id`-style segments, so this is always a string at runtime.
export function paramAsString(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : (value ?? '');
}

export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
