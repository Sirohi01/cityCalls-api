import { StatusTransitionModel, EntityType } from '../modules/config/statusTransition.model';
import { Role } from '../modules/users/users.types';
import { InvalidTransitionError, ForbiddenError } from './errors';

// Loaded into memory on boot, refreshed on config change — mirrors the pattern
// in permissionCache.ts. This is the single enforcement point for every status
// change in the system; no controller ever writes a status field without going
// through assertValidTransition first. Per docs/07-status-transition-matrix.md
// and docs/manish/06-workflow-engine-plan.md §1.
type CacheKey = `${EntityType}:${string}:${string}`;
let cache: Map<CacheKey, Role[]> = new Map();
let byFromStatus: Map<`${EntityType}:${string}`, string[]> = new Map();

function transitionKey(entityType: EntityType, from: string, to: string): CacheKey {
  return `${entityType}:${from}:${to}`;
}

export async function loadStatusEngineCache(): Promise<void> {
  const rows = await StatusTransitionModel.find().lean();
  const next = new Map<CacheKey, Role[]>();
  const nextByFrom = new Map<`${EntityType}:${string}`, string[]>();

  for (const row of rows) {
    next.set(transitionKey(row.entityType, row.fromStatus, row.toStatus), row.allowedRoles);
    const fromKey = `${row.entityType}:${row.fromStatus}` as const;
    const existing = nextByFrom.get(fromKey) ?? [];
    existing.push(row.toStatus);
    nextByFrom.set(fromKey, existing);
  }

  cache = next;
  byFromStatus = nextByFrom;
  console.log(`[statusEngine] loaded ${cache.size} status-transition entries`);
}

export function getAllowedTransitions(entityType: EntityType, fromStatus: string): string[] {
  return byFromStatus.get(`${entityType}:${fromStatus}`) ?? [];
}

export function assertValidTransition(entityType: EntityType, fromStatus: string, toStatus: string, actorRole: Role): void {
  const allowedRoles = cache.get(transitionKey(entityType, fromStatus, toStatus));
  if (!allowedRoles) {
    throw new InvalidTransitionError(fromStatus, getAllowedTransitions(entityType, fromStatus));
  }
  if (!allowedRoles.includes(actorRole)) {
    throw new ForbiddenError(`Role ${actorRole} is not permitted to move ${entityType} from ${fromStatus} to ${toStatus}`);
  }
}
