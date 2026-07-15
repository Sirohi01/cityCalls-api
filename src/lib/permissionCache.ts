import { RolePermissionModel } from '../modules/config/rolePermissions.model';
import { Role, DataScope } from '../modules/users/users.types';

// In-memory permission cache, refreshed on boot and on role-permission config change.
// Per docs/manish/04-authentication-and-rbac-plan.md §4.
type CacheKey = `${Role}:${string}:${string}`;
let cache: Map<CacheKey, DataScope> = new Map();

function key(role: Role, moduleName: string, action: string): CacheKey {
  return `${role}:${moduleName}:${action}`;
}

export async function loadPermissionCache(): Promise<void> {
  const rows = await RolePermissionModel.find().lean();
  const next = new Map<CacheKey, DataScope>();
  for (const row of rows) {
    next.set(key(row.role, row.module, row.action), row.dataScope);
  }
  cache = next;
   
  console.log(`[permissions] loaded ${cache.size} role-permission entries`);
}

export function getDataScope(role: Role, moduleName: string, action: string): DataScope | undefined {
  return cache.get(key(role, moduleName, action));
}
