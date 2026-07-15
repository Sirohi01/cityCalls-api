import { FilterQuery } from 'mongoose';
import { DataScope } from '../modules/users/users.types';
import { AccessTokenPayload } from './jwt';

// Applies the caller's data scope as a query-level filter — enforcement happens
// in the query itself, not as a post-fetch check. Per docs/17-security-and-audit.md §2
// and docs/manish/04-authentication-and-rbac-plan.md §3.
//
// `ownerField` lets each module say what "OWN" means for its entity
// (e.g. 'createdBy' for Leads, 'assigneeId' for Service Requests).
export function applyScopeFilter<T>(
  baseFilter: FilterQuery<T>,
  scope: DataScope,
  user: AccessTokenPayload,
  ownerField = 'createdBy'
): FilterQuery<T> {
  switch (scope) {
    case 'OWN':
      return { ...baseFilter, [ownerField]: user.sub };
    case 'TEAM':
      return { ...baseFilter, teamId: user.teamId };
    case 'SUB_BRANCH':
      return { ...baseFilter, subBranchId: user.subBranchId };
    case 'BRANCH':
      return { ...baseFilter, branchId: user.branchId };
    case 'VENDOR':
      return { ...baseFilter, vendorId: user.vendorId };
    case 'ALL':
      return baseFilter;
    default:
      return baseFilter;
  }
}
