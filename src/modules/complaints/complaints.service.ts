import { ComplaintModel, ComplaintStatus } from './complaints.model';
import { CustomerModel } from '../customers/customers.model';
import { NotFoundError } from '../../lib/errors';
import { buildPaginationMeta } from '../../lib/apiResponse';
import { logActivity } from '../../lib/auditLog';
import { trigger } from '../../lib/notifications';
import { AccessTokenPayload } from '../../lib/jwt';
import { DataScope } from '../users/users.types';
import { CUSTOMER_ROLES_FOR_SCOPE, isCustomerRole, resolveOwnCustomerId } from '../../lib/ownCustomerScope';

interface ListParams {
  page: number;
  limit: number;
  status?: ComplaintStatus;
  customerId?: string;
}

export async function listComplaints(params: ListParams, scope: DataScope, user: AccessTokenPayload) {
  const filter: Record<string, unknown> = {};
  if (params.status) filter.status = params.status;
  if (params.customerId) filter.customerId = params.customerId;
  if (scope === 'BRANCH' || scope === 'ALL') {
    // Complaints aren't branch-scoped data (no branchId field — a customer's
    // complaint isn't tied to the branch that served them, since it may not
    // even reference a service request at all) — BRANCH-scoped staff see
    // everything the same as ALL-scoped staff do, same reasoning HappyCall's
    // list applies.
  }
  if (scope === 'OWN' && CUSTOMER_ROLES_FOR_SCOPE.includes(user.role)) {
    const ownCustomerId = await resolveOwnCustomerId(user.sub);
    filter.customerId = ownCustomerId ?? null;
  }

  const skip = (params.page - 1) * params.limit;
  const [items, total] = await Promise.all([
    ComplaintModel.find(filter)
      .populate('customerId', 'name contacts')
      .populate('serviceRequestId', 'number')
      .skip(skip)
      .limit(params.limit)
      .sort({ createdAt: -1 }),
    ComplaintModel.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta(params.page, params.limit, total) };
}

export async function getComplaint(id: string) {
  const complaint = await ComplaintModel.findById(id)
    .populate('customerId', 'name contacts')
    .populate('serviceRequestId', 'number status')
    .populate('respondedBy', 'name');
  if (!complaint) throw new NotFoundError('Complaint not found');
  return complaint;
}

// Same 404-not-403 pattern as assertOwnServiceRequestAccess (serviceRequests.service.ts)
// — an OWN-scoped caller shouldn't be able to use the response code to
// fingerprint whether an arbitrary complaint id exists.
export async function assertOwnComplaintAccess(complaint: { customerId?: unknown }, scope: DataScope, user: AccessTokenPayload): Promise<void> {
  if (scope !== 'OWN' || !isCustomerRole(user.role)) return;
  const ownId = await resolveOwnCustomerId(user.sub);
  const complaintCustomerId = (complaint.customerId as { toString(): string } | undefined)?.toString();
  if (!ownId || complaintCustomerId !== ownId) {
    throw new NotFoundError('Complaint not found');
  }
}

export async function createComplaint(data: { serviceRequestId?: string; subject: string; description: string }, actor: AccessTokenPayload) {
  const customer = await CustomerModel.findOne({ userId: actor.sub });
  if (!customer) throw new NotFoundError('Customer profile not found');

  const complaint = await ComplaintModel.create({
    customerId: customer._id,
    serviceRequestId: data.serviceRequestId,
    subject: data.subject,
    description: data.description,
  });

  await logActivity({
    entityType: 'COMPLAINT',
    entityId: complaint.id,
    user: actor,
    action: 'CREATED',
    module: 'complaints',
  });

  return complaint;
}

export async function respondToComplaint(id: string, response: string, status: 'RESOLVED' | 'CLOSED', actor: AccessTokenPayload) {
  const complaint = await ComplaintModel.findById(id);
  if (!complaint) throw new NotFoundError('Complaint not found');

  complaint.response = response;
  complaint.status = status;
  complaint.respondedBy = actor.sub as never;
  complaint.respondedAt = new Date();
  await complaint.save();

  await logActivity({
    entityType: 'COMPLAINT',
    entityId: id,
    user: actor,
    action: 'RESPONDED',
    module: 'complaints',
    newValue: { status, response },
  });

  await trigger('COMPLAINT_RESPONDED', {
    recipient: { customerId: complaint.customerId.toString() },
    variables: { subject: complaint.subject, status },
  });

  return complaint;
}

export async function updateComplaintStatus(id: string, status: ComplaintStatus, actor: AccessTokenPayload) {
  const complaint = await ComplaintModel.findById(id);
  if (!complaint) throw new NotFoundError('Complaint not found');

  const oldStatus = complaint.status;
  complaint.status = status;
  await complaint.save();

  await logActivity({
    entityType: 'COMPLAINT',
    entityId: id,
    user: actor,
    action: 'STATUS_CHANGED',
    module: 'complaints',
    oldValue: { status: oldStatus },
    newValue: { status },
  });

  return complaint;
}
