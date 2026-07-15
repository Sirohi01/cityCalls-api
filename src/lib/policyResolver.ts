import { PolicyModel, PolicyType, PolicyScope } from '../modules/config/policy.model';

export interface PolicyContext {
  customerId?: string;
  contractId?: string;
  brandId?: string;
  productId?: string;
  serviceId?: string;
  branchId?: string;
}

// Most-specific-wins resolution order per docs/09-database-architecture.md §5:
// CUSTOMER > CONTRACT > BRAND > PRODUCT > SERVICE > BRANCH > GLOBAL.
const SCOPE_ORDER: { scope: PolicyScope; refKey: keyof PolicyContext | null }[] = [
  { scope: 'CUSTOMER', refKey: 'customerId' },
  { scope: 'CONTRACT', refKey: 'contractId' },
  { scope: 'BRAND', refKey: 'brandId' },
  { scope: 'PRODUCT', refKey: 'productId' },
  { scope: 'SERVICE', refKey: 'serviceId' },
  { scope: 'BRANCH', refKey: 'branchId' },
  { scope: 'GLOBAL', refKey: null },
];

// The only place a hardcoded default may appear — a bootstrap fallback used only
// if no GLOBAL policy has been seeded yet. Seed a GLOBAL policy on setup to override.
const HARDCODED_FALLBACK: Record<PolicyType, Record<string, unknown>> = {
  REOPEN: { windowDays: 90 },
  WARRANTY: { defaultDays: 365 },
  CANCELLATION: { allowedUntilStatus: 'ACCEPTED', feeAppliesAfter: 'APPOINTMENT_SCHEDULED' },
  RESCHEDULE: { maxReschedules: 3 },
};

export async function resolvePolicy(
  policyType: PolicyType,
  context: PolicyContext
): Promise<Record<string, unknown>> {
  for (const { scope, refKey } of SCOPE_ORDER) {
    const refId = refKey ? context[refKey] : undefined;
    if (refKey && !refId) continue; // no value in context for this scope, skip

    const policy = await PolicyModel.findOne({
      policyType,
      scope,
      scopeRefId: refId ?? undefined,
    }).lean();

    if (policy) return policy.rules;
  }

  return HARDCODED_FALLBACK[policyType];
}
