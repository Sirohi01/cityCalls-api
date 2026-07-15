import { ApiError } from './apiResponse';

// Error code registry — must match docs/18-error-handling-standards.md §2.
// Add a row there in the same PR that introduces a new code here.
export class AppError extends Error {
  statusCode: number;
  errors: ApiError[];

  constructor(statusCode: number, message: string, errors: ApiError[] = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors.length > 0 ? errors : [{ field: 'general', code: 'ERROR', message }];
  }
}

export class ValidationError extends AppError {
  constructor(errors: ApiError[]) {
    super(422, 'Validation failed', errors);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(404, message, [{ field: 'id', code: 'NOT_FOUND', message }]);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, message, [{ field: 'auth', code: 'UNAUTHORIZED', message }]);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(403, message, [{ field: 'permission', code: 'FORBIDDEN', message }]);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code = 'CONFLICT') {
    super(409, message, [{ field: 'general', code, message }]);
  }
}

export class InvalidTransitionError extends ConflictError {
  constructor(currentStatus: string, allowedTransitions: string[]) {
    super(
      `Cannot transition from ${currentStatus}. Allowed: ${allowedTransitions.join(', ') || 'none'}`,
      'INVALID_TRANSITION'
    );
  }
}
