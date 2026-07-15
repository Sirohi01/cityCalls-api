import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AccessTokenPayload } from '../lib/jwt';
import { UnauthorizedError } from '../lib/errors';

export interface AuthenticatedRequest extends Request {
  user?: AccessTokenPayload;
}

// Verifies the JWT and attaches the decoded payload to req.user.
// Per docs/17-security-and-audit.md §1-2.
export function authMiddleware(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new UnauthorizedError('Missing or malformed Authorization header'));
    return;
  }

  const token = header.slice('Bearer '.length);
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired access token'));
  }
}
