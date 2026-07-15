import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { getDataScope } from '../lib/permissionCache';
import { ForbiddenError, UnauthorizedError } from '../lib/errors';
import { DataScope } from '../modules/users/users.types';

export interface ScopedRequest extends AuthenticatedRequest {
  scope?: DataScope;
}

// Checks role-permission for {module, action}, attaches the resolved dataScope
// to req.scope for the controller/service to apply as a query filter.
// Per docs/05-user-roles-and-permissions.md and docs/17-security-and-audit.md §2.
export function requirePermission(moduleName: string, action: string) {
  return (req: ScopedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }
    const scope = getDataScope(req.user.role, moduleName, action);
    if (!scope) {
      next(new ForbiddenError(`Role ${req.user.role} lacks permission for ${moduleName}.${action}`));
      return;
    }
    req.scope = scope;
    next();
  };
}
