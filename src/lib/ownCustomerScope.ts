import { CustomerModel } from '../modules/customers/customers.model';
import { AccessTokenPayload } from './jwt';

// Shared by every module where a CUSTOMER/BUSINESS_CUSTOMER caller's OWN
// scope means "records belonging to my own Customer document" (service
// requests, estimates, invoices, ...) — these roles authenticate as a User,
// but the entities they own are keyed by Customer._id, a separate document
// linked via Customer.userId. See serviceRequests.service.ts's original
// version of this check for the fuller history of why it exists.
export const CUSTOMER_ROLES_FOR_SCOPE = ['CUSTOMER', 'BUSINESS_CUSTOMER'];

export function isCustomerRole(role: string): boolean {
  return CUSTOMER_ROLES_FOR_SCOPE.includes(role);
}

export async function resolveOwnCustomerId(userId: string): Promise<string | null> {
  const customer = await CustomerModel.findOne({ userId }).select('_id');
  return customer ? customer._id.toString() : null;
}

// 404, not 403, on mismatch — an OWN-scoped caller shouldn't be able to use
// the response code to fingerprint whether an arbitrary id exists.
export async function assertOwnCustomerRecord(
  recordCustomerId: unknown,
  scope: string,
  user: AccessTokenPayload
): Promise<void> {
  if (scope !== 'OWN' || !isCustomerRole(user.role)) return;
  const ownId = await resolveOwnCustomerId(user.sub);
  const recordId = (recordCustomerId as { toString(): string } | undefined)?.toString();
  if (!ownId || recordId !== ownId) {
    const { NotFoundError } = await import('./errors');
    throw new NotFoundError('Record not found');
  }
}
