import { ServiceRequestModel, ServiceRequestStatus, AssigneeType, IServiceRequest } from './serviceRequests.model';
import { AssignmentHistoryModel } from './assignmentHistory.model';
import { ServiceModel } from '../catalog/catalog.model';
import { BranchModel, IBranch } from '../organization/organization.model';
import { EmployeeModel } from '../employees/employees.model';
import { TeamModel } from '../organization/organization.model';
import { NotFoundError, ConflictError, AppError } from '../../lib/errors';
import { buildPaginationMeta } from '../../lib/apiResponse';
import { getNextNumber } from '../../lib/numbering';
import { assertValidTransition, getAllowedTransitions } from '../../lib/statusEngine';
import { addBusinessMinutes } from '../../lib/businessCalendar';
import { resolvePolicy } from '../../lib/policyResolver';
import { logActivity } from '../../lib/auditLog';
import { sendPlaceholderNotification } from '../../lib/notificationStub';
import { emitServiceRequestStatusChanged, emitServiceRequestAssigned, emitTechnicianLocationUpdated } from '../../realtime';
import { AccessTokenPayload } from '../../lib/jwt';
import { CustomerModel, CustomerProductModel } from '../customers/customers.model';
import { ReopenRecordModel } from '../follow-up/reopenRecords.model';
import { OtpModel } from '../auth/otp.model';
import crypto from 'crypto';
import { UnauthorizedError } from '../../lib/errors';

const ASSIGNEE_TYPE_TO_STATUS: Record<AssigneeType, ServiceRequestStatus> = {
  BRANCH: 'ASSIGNED_TO_BRANCH',
  SUB_BRANCH: 'ASSIGNED_TO_SUB_BRANCH',
  TEAM: 'ASSIGNED_TO_TEAM',
  EMPLOYEE: 'ASSIGNED_TO_EMPLOYEE',
  VENDOR: 'ASSIGNED_TO_VENDOR',
  OUTSOURCED_PARTNER: 'OUTSOURCED',
};

const TERMINAL_ROLES_WITH_BYPASS = ['SUPER_ADMIN', 'ADMIN'];

interface ListParams {
  page: number;
  limit: number;
  status?: string;
  status_in?: string;
  branchId?: string;
  assigneeId?: string;
  priority?: string;
  customerId?: string;
  q?: string;
}

export async function listServiceRequests(params: ListParams) {
  const filter: Record<string, unknown> = {};
  if (params.status) filter.status = params.status;
  if (params.status_in) filter.status = { $in: params.status_in.split(',') };
  if (params.branchId) filter.branchId = params.branchId;
  if (params.assigneeId) filter.assigneeId = params.assigneeId;
  if (params.priority) filter.priority = params.priority;
  if (params.customerId) filter.customerId = params.customerId;
  if (params.q) filter.number = { $regex: params.q, $options: 'i' };

  const skip = (params.page - 1) * params.limit;
  const [items, total] = await Promise.all([
    ServiceRequestModel.find(filter).skip(skip).limit(params.limit).sort({ createdAt: -1 }),
    ServiceRequestModel.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta(params.page, params.limit, total) };
}

export async function getServiceRequest(id: string) {
  const sr = await ServiceRequestModel.findById(id);
  if (!sr) throw new NotFoundError('Service request not found');
  return sr;
}

// Resolves the owning branch by pin-code + service-category coverage — mirrors
// catalog.service.checkCoverage but returns the full branch doc, since creation
// needs it for SLA calculation too, not just a serviceable/not-serviceable flag.
async function resolveBranch(serviceId: string, pinCode: string): Promise<IBranch | null> {
  const service = await ServiceModel.findById(serviceId);
  if (!service || !service.active) return null;

  return BranchModel.findOne({
    active: true,
    'coverage.pinCodes': pinCode,
    serviceCategoryIds: service.categoryId,
  });
}

export async function createServiceRequest(data: Record<string, unknown> & { addressSnapshot: { pinCode: string } }, createdBy: string) {
  const branch = await resolveBranch(data.serviceId as string, data.addressSnapshot.pinCode);
  const service = await ServiceModel.findById(data.serviceId);

  const number = await getNextNumber('SERVICE_REQUEST', branch?._id.toString());
  const dueAt = branch
    ? addBusinessMinutes(new Date(), service?.slaMinutes ?? 1440, branch)
    : addBusinessMinutes(new Date(), service?.slaMinutes ?? 1440, null);

  const sr = await ServiceRequestModel.create({
    ...data,
    number,
    branchId: branch?._id,
    status: branch ? 'ASSIGNED_TO_BRANCH' : 'NEEDS_MANUAL_BRANCH_ASSIGNMENT',
    sla: { dueAt },
    createdBy,
  });

  sendPlaceholderNotification({
    to: data.customerId as string,
    purpose: 'SERVICE_REQUEST_CREATED',
    payload: { serviceRequestId: sr._id.toString(), number },
  });

  return sr;
}

interface StatusChangeMeta {
  reason?: string;
  geo?: { lat: number; lng: number };
}

// Single entry point every status-changing action goes through — per
// docs/manish/06-workflow-engine-plan.md §6, this is where the transition check,
// history write, notification trigger, and real-time emit all happen together,
// so no code path can change a status without its required side effects.
export async function updateStatus(id: string, toStatus: ServiceRequestStatus, actor: AccessTokenPayload, meta: StatusChangeMeta = {}) {
  const sr = await ServiceRequestModel.findById(id);
  if (!sr) throw new NotFoundError('Service request not found');

  assertValidTransition('SERVICE_REQUEST', sr.status, toStatus, actor.role);

  const fromStatus = sr.status;
  sr.status = toStatus;
  if (toStatus === 'SERVICE_COMPLETED') sr.completedAt = new Date();
  if (toStatus === 'CLOSED') sr.closedAt = new Date();
  await sr.save();

  await logActivity({
    entityType: 'SERVICE_REQUEST',
    entityId: id,
    user: actor,
    action: 'STATUS_CHANGED',
    module: 'service-requests',
    oldValue: { status: fromStatus },
    newValue: { status: toStatus },
    reason: meta.reason,
  });

  emitServiceRequestStatusChanged(id, { serviceRequestId: id, fromStatus, toStatus });
  sendPlaceholderNotification({
    to: sr.customerId.toString(),
    purpose: `SERVICE_REQUEST_${toStatus}`,
    payload: { serviceRequestId: id, status: toStatus },
  });

  return sr;
}

export function allowedNextStatuses(currentStatus: ServiceRequestStatus): string[] {
  return getAllowedTransitions('SERVICE_REQUEST', currentStatus);
}

interface AssignInput {
  assigneeType: AssigneeType;
  assigneeId: string;
  method: 'MANUAL' | 'RULE_ENGINE' | 'BYPASS';
  reason?: string;
}

// Enforces the bypass rule from docs/05-user-roles-and-permissions.md §6: only
// Super Admin/Admin may assign outside their own branch; everyone else is
// confined to the Service Request's own branch.
async function assertAssignmentInScope(sr: Pick<IServiceRequest, 'branchId'>, input: AssignInput, actor: AccessTokenPayload): Promise<void> {
  if (TERMINAL_ROLES_WITH_BYPASS.includes(actor.role)) return;

  if (input.assigneeType === 'EMPLOYEE') {
    const employee = await EmployeeModel.findById(input.assigneeId);
    if (!employee || employee.branchId.toString() !== actor.branchId) {
      throw new AppError(403, 'You can only assign to employees within your own branch', [
        { field: 'assigneeId', code: 'ASSIGNMENT_OUT_OF_SCOPE', message: 'Employee is outside your branch' },
      ]);
    }
  } else if (input.assigneeType === 'TEAM') {
    const team = await TeamModel.findById(input.assigneeId);
    if (!team || team.branchId.toString() !== actor.branchId) {
      throw new AppError(403, 'You can only assign to teams within your own branch', [
        { field: 'assigneeId', code: 'ASSIGNMENT_OUT_OF_SCOPE', message: 'Team is outside your branch' },
      ]);
    }
  } else if (sr.branchId && sr.branchId.toString() !== actor.branchId) {
    throw new AppError(403, 'You can only assign Service Requests within your own branch', [
      { field: 'general', code: 'ASSIGNMENT_OUT_OF_SCOPE', message: 'Service Request is outside your branch' },
    ]);
  }
}

export async function assignServiceRequest(id: string, input: AssignInput, actor: AccessTokenPayload) {
  const sr = await ServiceRequestModel.findById(id);
  if (!sr) throw new NotFoundError('Service request not found');

  await assertAssignmentInScope(sr, input, actor);

  const toStatus = ASSIGNEE_TYPE_TO_STATUS[input.assigneeType];
  assertValidTransition('SERVICE_REQUEST', sr.status, toStatus, actor.role);

  const fromAssigneeType = sr.assigneeType;
  const fromAssigneeId = sr.assigneeId;

  sr.assigneeType = input.assigneeType;
  sr.assigneeId = input.assigneeId as never;
  sr.status = toStatus;
  await sr.save();

  await AssignmentHistoryModel.create({
    serviceRequestId: id,
    fromAssigneeType,
    fromAssigneeId,
    toAssigneeType: input.assigneeType,
    toAssigneeId: input.assigneeId,
    action: fromAssigneeType ? 'REASSIGNED' : 'ASSIGNED',
    reason: input.reason,
    actorId: actor.sub,
    actorRole: actor.role,
    method: input.method,
  });

  emitServiceRequestAssigned(id, { serviceRequestId: id, assigneeType: input.assigneeType, assigneeId: input.assigneeId });
  sendPlaceholderNotification({ to: input.assigneeId, purpose: 'SERVICE_REQUEST_ASSIGNED', payload: { serviceRequestId: id } });

  return sr;
}

export async function cancelServiceRequest(id: string, reason: string, actor: AccessTokenPayload) {
  const sr = await ServiceRequestModel.findById(id);
  if (!sr) throw new NotFoundError('Service request not found');

  assertValidTransition('SERVICE_REQUEST', sr.status, 'CANCELLED', actor.role);

  const fromStatus = sr.status;
  sr.status = 'CANCELLED';
  sr.cancelledAt = new Date();
  sr.cancelReason = reason;
  await sr.save();

  await logActivity({
    entityType: 'SERVICE_REQUEST',
    entityId: id,
    user: actor,
    action: 'CANCELLED',
    module: 'service-requests',
    reason,
  });

  emitServiceRequestStatusChanged(id, { serviceRequestId: id, fromStatus, toStatus: 'CANCELLED' });
  return sr;
}

// Basic reopen per docs/06-complete-workflow-document.md Stage 11 — checks
// eligibility against the resolved policy and links the new request back to the
// original. Traces back to the ROOT of the reopen chain (a request reopened
// twice counts as reopenCount 2 against the very first original, not just its
// immediate parent) so recurring-issue reporting is accurate across multiple
// reopens of the same underlying case.
async function findRootServiceRequestId(sr: { isReopen: boolean; originalServiceRequestId?: unknown }): Promise<string> {
  let current = sr;
  let currentId = (current as { _id?: unknown })._id;
  while (current.isReopen && current.originalServiceRequestId) {
    const parent = await ServiceRequestModel.findById(current.originalServiceRequestId);
    if (!parent) break;
    currentId = parent._id;
    current = parent;
  }
  return (currentId as { toString(): string }).toString();
}

export async function reopenServiceRequest(id: string, reason: string, actor: AccessTokenPayload) {
  const original = await ServiceRequestModel.findById(id);
  if (!original) throw new NotFoundError('Service request not found');
  if (!['CLOSED', 'PAID'].includes(original.status)) {
    throw new ConflictError('Only a closed or paid service request can be reopened', 'REOPEN_NOT_ALLOWED');
  }

  // The original transitions to the terminal REOPENED status (not left dangling
  // at CLOSED) — REOPENED is defined as "terminal-of-original, spawns a new
  // linked Service Request" in docs/07-status-transition-matrix.md §1.
  assertValidTransition('SERVICE_REQUEST', original.status, 'REOPENED', actor.role);

  const policy = await resolvePolicy('REOPEN', {
    customerId: original.customerId.toString(),
    serviceId: original.serviceId.toString(),
    branchId: original.branchId?.toString(),
  });
  const windowDays = (policy.windowDays as number) ?? 90;
  const referenceDate = original.completedAt ?? original.closedAt ?? original.updatedAt;
  const withinWindow = referenceDate ? Date.now() - referenceDate.getTime() <= windowDays * 86_400_000 : false;

  // Warranty applicability — in-warranty reopens typically waive the visiting
  // charge (docs/06-complete-workflow-document.md Stage 11), checked against
  // the linked appliance's warrantyExpiresAt, not just the reopen window itself.
  let warrantyApplied = false;
  if (original.customerProductId) {
    const product = await CustomerProductModel.findById(original.customerProductId);
    warrantyApplied = !!product?.warrantyExpiresAt && product.warrantyExpiresAt.getTime() > Date.now();
  }

  const rootId = await findRootServiceRequestId(original);
  const priorReopenCount = await ReopenRecordModel.countDocuments({ originalServiceRequestId: rootId });
  const reopenCount = priorReopenCount + 1;

  original.status = 'REOPENED';
  await original.save();

  const number = await getNextNumber('SERVICE_REQUEST', original.branchId?.toString());
  const newSr = await ServiceRequestModel.create({
    number,
    customerId: original.customerId,
    customerProductId: original.customerProductId,
    addressSnapshot: original.addressSnapshot,
    serviceId: original.serviceId,
    branchId: original.branchId,
    subBranchId: original.subBranchId,
    // Default policy: route back to the original assignee first.
    assigneeType: original.assigneeType,
    assigneeId: original.assigneeId,
    status: original.assigneeType ? ASSIGNEE_TYPE_TO_STATUS[original.assigneeType] : 'NEEDS_MANUAL_BRANCH_ASSIGNMENT',
    priority: original.priority,
    source: 'REOPEN',
    symptoms: original.symptoms,
    isReopen: true,
    originalServiceRequestId: original._id,
    createdBy: actor.sub,
  });

  const reopenRecord = await ReopenRecordModel.create({
    originalServiceRequestId: rootId,
    newServiceRequestId: newSr._id,
    reason,
    reopenedBy: actor.sub,
    withinPolicyWindow: withinWindow,
    warrantyApplied,
    reopenCount,
  });

  await logActivity({
    entityType: 'SERVICE_REQUEST',
    entityId: id,
    user: actor,
    action: 'REOPENED',
    module: 'service-requests',
    reason,
    newValue: { newServiceRequestId: newSr._id, withinPolicyWindow: withinWindow, windowDays, reopenCount, warrantyApplied },
  });

  if (original.assigneeId) {
    sendPlaceholderNotification({
      to: original.assigneeId.toString(),
      purpose: 'COMPLAINT_REOPENED',
      payload: { originalServiceRequestId: id, newServiceRequestId: newSr._id.toString() },
    });
  }

  // Recurring-issue signal: flag for management attention rather than block
  // the reopen — per docs/06 Stage 11, a high reopen count on the same
  // product/customer indicates an unresolved underlying defect worth escalating.
  if (reopenCount >= 3) {
    newSr.isEscalated = true;
    newSr.escalationReason = `Recurring issue: reopened ${reopenCount} times`;
    await newSr.save();
  }

  return { newServiceRequest: newSr, reopenRecord, withinPolicyWindow: withinWindow, warrantyApplied, reopenCount, windowDays };
}

export async function getReopenHistory(serviceRequestId: string) {
  const sr = await ServiceRequestModel.findById(serviceRequestId);
  if (!sr) throw new NotFoundError('Service request not found');
  const rootId = await findRootServiceRequestId(sr);
  return ReopenRecordModel.find({ originalServiceRequestId: rootId }).sort({ reopenedAt: 1 });
}

export async function getAssignmentHistory(serviceRequestId: string) {
  return AssignmentHistoryModel.find({ serviceRequestId }).sort({ timestamp: -1 });
}

function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

// Completion-proof OTP — docs/manish/09-vendor-app-functional-plan.md §8, distinct
// from the login OTP in auth.service.ts (this confirms work completion with the
// customer present, it never issues a session). Reuses the OTP collection/shape
// since the generate/hash/expire/attempt-limit mechanics are identical.
export async function requestCompletionOtp(serviceRequestId: string): Promise<void> {
  const sr = await ServiceRequestModel.findById(serviceRequestId);
  if (!sr) throw new NotFoundError('Service request not found');

  const customer = await CustomerModel.findById(sr.customerId);
  const mobile = customer?.contacts.find((c) => c.isPrimary)?.mobile ?? customer?.contacts[0]?.mobile;
  if (!mobile) throw new ConflictError('Customer has no registered mobile number for completion confirmation', 'NO_CUSTOMER_MOBILE');

  const otp = generateOtp();
  await OtpModel.create({
    mobile,
    otpHash: hashOtp(otp),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  sendPlaceholderNotification({ to: mobile, purpose: 'SERVICE_COMPLETION_OTP', payload: { serviceRequestId, otp } });
}

export async function verifyCompletionOtp(serviceRequestId: string, otp: string): Promise<{ verified: true }> {
  const sr = await ServiceRequestModel.findById(serviceRequestId);
  if (!sr) throw new NotFoundError('Service request not found');

  const customer = await CustomerModel.findById(sr.customerId);
  const mobile = customer?.contacts.find((c) => c.isPrimary)?.mobile ?? customer?.contacts[0]?.mobile;

  const record = await OtpModel.findOne({ mobile }).sort({ createdAt: -1 });
  if (!record || record.verified || record.expiresAt < new Date()) {
    throw new UnauthorizedError('OTP expired or not found. Please request a new one.');
  }
  if (record.attempts >= 5) {
    throw new UnauthorizedError('Too many incorrect attempts. Please request a new OTP.');
  }
  if (record.otpHash !== hashOtp(otp)) {
    record.attempts += 1;
    await record.save();
    throw new UnauthorizedError('Incorrect OTP');
  }

  record.verified = true;
  await record.save();
  return { verified: true };
}

// Periodic technician-location ping while TECHNICIAN_EN_ROUTE — docs/manish/09 §5.
// Event-based, not a continuous GPS trail (docs/08-system-architecture.md §4).
export async function recordLocationPing(serviceRequestId: string, geo: { lat: number; lng: number }): Promise<void> {
  emitTechnicianLocationUpdated(serviceRequestId, { serviceRequestId, geo, at: new Date() });
}
