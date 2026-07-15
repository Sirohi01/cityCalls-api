import { Response, NextFunction } from 'express';
import { getDataScope } from '../../lib/permissionCache';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../../lib/errors';
import { ScopedRequest } from '../../middleware/permission.middleware';
import { paramAsString } from '../../lib/apiResponse';
import { EXPORT_REGISTRY } from './exportRegistry';
import { IMPORT_REGISTRY } from './importRegistry';

// requirePermission (middleware/permission.middleware.ts) needs its module
// name at route-registration time; export/import use one generic
// /export/:entity or /import/:entity route whose target module is only
// known once :entity is parsed from the request, so this re-implements the
// same {role, module, action} → dataScope lookup, driven by the relevant
// registry's permissionModule mapping instead of a fixed string.
export function requireEntityPermission(action: 'export' | 'import') {
  const registry = action === 'export' ? EXPORT_REGISTRY : IMPORT_REGISTRY;
  return (req: ScopedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }
    const entity = paramAsString(req.params.entity);
    const def = registry[entity];
    if (!def) {
      next(new NotFoundError(`Unknown ${action} entity: ${entity}`));
      return;
    }
    const scope = getDataScope(req.user.role, def.permissionModule, action);
    if (!scope) {
      next(new ForbiddenError(`Role ${req.user.role} lacks permission for ${def.permissionModule}.${action}`));
      return;
    }
    req.scope = scope;
    next();
  };
}
