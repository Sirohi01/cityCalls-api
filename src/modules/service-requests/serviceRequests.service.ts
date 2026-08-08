import { Types } from 'mongoose';
import { ServiceRequestModel, ServiceRequestStatus, AssigneeType, IServiceRequest } from './serviceRequests.model';
import { AssignmentHistoryModel } from './assignmentHistory.model';
import { ActivityLogModel } from '../audit/activityLog.model';
import { ServiceModel } from '../catalog/catalog.model';
import { BranchModel, IBranch, SubBranchModel } from '../organization/organization.model';
import { EmployeeModel } from '../employees/employees.model';
import { TeamModel } from '../organization/organization.model';
import { VendorModel } from '../vendors/vendors.model';
import { NotFoundError, ConflictError, AppError } from '../../lib/errors';
import { buildPaginationMeta } from '../../lib/apiResponse';
import { getNextNumber } from '../../lib/numbering';
import { assertValidTransition, getAllowedTransitions } from '../../lib/statusEngine';
import { addBusinessMinutes } from '../../lib/businessCalendar';
import { resolvePolicy } from '../../lib/policyResolver';
import { logActivity } from '../../lib/auditLog';
import { trigger } from '../../lib/notifications';
import { emitServiceRequestStatusChanged, emitServiceRequestAssigned, emitTechnicianLocationUpdated } from '../../realtime';
import { AccessTokenPayload } from '../../lib/jwt';
import { DataScope } from '../users/users.types';
import { CustomerModel, CustomerProductModel } from '../customers/customers.model';
import { ReopenRecordModel, IReopenRecord } from '../follow-up/reopenRecords.model';
import { UserModel } from '../users/users.model';
import { OtpModel } from '../auth/otp.model';
import crypto from 'crypto';
import { UnauthorizedError } from '../../lib/errors';
import { resolveVerticalServiceIds } from '../../lib/verticals';
import { assertSlotAvailable } from '../appointment-slots/appointmentSlots.service';
import { env } from '../../config/env';

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
  vertical?: string;
}

const CUSTOMER_ROLES_FOR_SCOPE = ['CUSTOMER', 'BUSINESS_CUSTOMER'];
const EMPLOYEE_ROLES_FOR_SCOPE = ['EMPLOYEE', 'TECHNICIAN'];
// Outsourced vendor staff. VENDOR_OWNER/VENDOR_MANAGER get dataScope 'VENDOR'
// on serviceRequests (scripts/seed.ts); VENDOR_TECHNICIAN gets 'OWN' but a job
// is assigned to the Vendor company as a whole (assigneeType 'VENDOR',
// assigneeId = Vendor._id — there's no per-technician sub-assignment in the
// data model), so "my jobs" for a vendor technician means the same thing as
// "my company's jobs" for the owner/manager: everything assigned to their vendorId.
const VENDOR_ROLES_FOR_SCOPE = ['VENDOR_OWNER', 'VENDOR_MANAGER', 'VENDOR_TECHNICIAN'];

export async function listServiceRequests(params: ListParams, scope: DataScope, user: AccessTokenPayload) {
  const filter: Record<string, unknown> = {};
  if (params.status) filter.status = params.status;
  if (params.status_in) filter.status = { $in: params.status_in.split(',') };
  if (params.branchId) filter.branchId = params.branchId;
  if (params.assigneeId) filter.assigneeId = params.assigneeId;
  if (params.priority) filter.priority = params.priority;
  if (params.customerId) filter.customerId = params.customerId;
  if (params.q) filter.number = { $regex: params.q, $options: 'i' };
  if (params.vertical) filter.serviceId = { $in: await resolveVerticalServiceIds(params.vertical) };
  if (scope === 'BRANCH' && user.branchId) filter.branchId = user.branchId;
  if (scope === 'SUB_BRANCH' && user.subBranchId) filter.subBranchId = user.subBranchId;
  if (scope === 'OWN' && CUSTOMER_ROLES_FOR_SCOPE.includes(user.role)) {
    const ownCustomer = await CustomerModel.findOne({ userId: user.sub }).select('_id');
    filter.customerId = ownCustomer ? ownCustomer._id : null;
  }
  // Vendor-mobile's "My Jobs" list — a technician's own assigned jobs only,
  // never trusting a client-supplied assigneeId for this. employeeId comes
  // from the JWT (resolved at login, auth.service.ts's issueTokens), not the
  // Employee._id a caller could pass in params.
  if (scope === 'OWN' && EMPLOYEE_ROLES_FOR_SCOPE.includes(user.role)) {
    filter.assigneeType = 'EMPLOYEE';
    filter.assigneeId = user.employeeId ?? null;
  }
  // Outsourced vendor staff — 'VENDOR' scope (owner/manager) and 'OWN' scope
  // (technician) both resolve to the same thing, per the VENDOR_ROLES_FOR_SCOPE
  // comment above. vendorId comes from the JWT (resolved at login), never a
  // client-supplied param, same reasoning as the EMPLOYEE case.
  if ((scope === 'VENDOR' || scope === 'OWN') && VENDOR_ROLES_FOR_SCOPE.includes(user.role)) {
    filter.assigneeType = 'VENDOR';
    filter.assigneeId = user.vendorId ?? null;
  }

  const skip = (params.page - 1) * params.limit;
  const [items, total] = await Promise.all([
    ServiceRequestModel.find(filter)
      .populate<{ customerId: { _id: Types.ObjectId; name: string; contacts: { mobile: string; isPrimary: boolean }[] } | null }>('customerId', 'name contacts')
      .populate<{ serviceId: { _id: Types.ObjectId; name: string } | null }>('serviceId', 'name')
      .skip(skip)
      .limit(params.limit)
      .sort({ createdAt: -1 }),
    ServiceRequestModel.countDocuments(filter),
  ]);

  const nameByAssignee = await resolveAssigneeNames(
    items.filter((i): i is typeof i & { assigneeType: AssigneeType; assigneeId: Types.ObjectId } => !!i.assigneeType && !!i.assigneeId)
  );

  const shaped = items.map((item) => {
    const obj = item.toObject();
    const customer = obj.customerId as unknown as { _id: Types.ObjectId; name: string; contacts: { mobile: string; isPrimary: boolean }[] } | null;
    const service = obj.serviceId as unknown as { _id: Types.ObjectId; name: string } | null;
    return {
      ...obj,
      customerId: customer?._id,
      customer: customer ? { name: customer.name, mobile: customer.contacts.find((c) => c.isPrimary)?.mobile ?? customer.contacts[0]?.mobile } : null,
      serviceId: service?._id,
      service: service ? { name: service.name } : null,
      assignee:
        item.assigneeType && item.assigneeId
          ? { type: item.assigneeType, name: nameByAssignee.get(`${item.assigneeType}:${item.assigneeId.toString()}`) ?? null }
          : null,
    };
  });

  return { items: shaped, meta: buildPaginationMeta(params.page, params.limit, total) };
}

// Resolves display names for whatever assigneeId values currently point at —
// the model each refers to depends entirely on assigneeType, so there's no
// single populate() that covers all six ASSIGNEE_TYPES. Batches by type
// (one findMany per type present) rather than one query per row.
async function resolveAssigneeNames(
  entries: { assigneeType: AssigneeType; assigneeId: Types.ObjectId }[]
): Promise<Map<string, string>> {
  const idsByType = new Map<AssigneeType, Set<string>>();
  for (const e of entries) {
    if (!idsByType.has(e.assigneeType)) idsByType.set(e.assigneeType, new Set());
    idsByType.get(e.assigneeType)!.add(e.assigneeId.toString());
  }

  const result = new Map<string, string>();
  for (const [type, idSet] of idsByType) {
    const ids = Array.from(idSet);
    switch (type) {
      case 'EMPLOYEE': {
        const employees = await EmployeeModel.find({ _id: { $in: ids } }).populate<{ userId: { name: string } }>('userId', 'name');
        for (const e of employees) result.set(`EMPLOYEE:${e._id.toString()}`, e.userId?.name ?? '');
        break;
      }
      case 'VENDOR': {
        const vendors = await VendorModel.find({ _id: { $in: ids } });
        for (const v of vendors) result.set(`VENDOR:${v._id.toString()}`, v.companyName);
        break;
      }
      case 'TEAM': {
        const teams = await TeamModel.find({ _id: { $in: ids } });
        for (const t of teams) result.set(`TEAM:${t._id.toString()}`, t.name);
        break;
      }
      case 'BRANCH': {
        const branches = await BranchModel.find({ _id: { $in: ids } });
        for (const b of branches) result.set(`BRANCH:${b._id.toString()}`, b.name);
        break;
      }
      case 'SUB_BRANCH': {
        const subBranches = await SubBranchModel.find({ _id: { $in: ids } });
        for (const sb of subBranches) result.set(`SUB_BRANCH:${sb._id.toString()}`, sb.name);
        break;
      }
      case 'OUTSOURCED_PARTNER':
        // No dedicated OutsourcedPartner model exists yet — a documented gap,
        // not a fabricated name.
        break;
    }
  }
  return result;
}

export async function getServiceRequest(id: string) {
  const sr = await ServiceRequestModel.findById(id)
    .populate<{ customerId: { name: string; contacts: { mobile: string; isPrimary: boolean }[] } }>('customerId', 'name contacts')
    .populate<{ serviceId: { name: string } }>('serviceId', 'name')
    .populate<{ createdBy: { name: string } }>('createdBy', 'name')
    .populate<{
      customerProductId: { brandId: { label: string }; productTypeId: { label: string }; modelNumber?: string; purchaseDate?: Date; warrantyExpiresAt?: Date } | null;
    }>({
      path: 'customerProductId',
      populate: [
        { path: 'brandId', select: 'label' },
        { path: 'productTypeId', select: 'label' },
      ],
    });
  if (!sr) throw new NotFoundError('Service request not found');

  const assigneeName =
    sr.assigneeType && sr.assigneeId
      ? (await resolveAssigneeNames([{ assigneeType: sr.assigneeType, assigneeId: sr.assigneeId }])).get(`${sr.assigneeType}:${sr.assigneeId.toString()}`) ?? null
      : null;

  const obj = sr.toObject();
  const customer = obj.customerId as unknown as { _id: Types.ObjectId; name: string; contacts: { mobile: string; isPrimary: boolean }[] } | null;
  const service = obj.serviceId as unknown as { _id: Types.ObjectId; name: string } | null;
  const createdByUser = obj.createdBy as unknown as { name: string } | null;
  const customerProduct = obj.customerProductId as unknown as {
    brandId: { label: string };
    productTypeId: { label: string };
    modelNumber?: string;
    purchaseDate?: Date;
    warrantyExpiresAt?: Date;
  } | null;

  return {
    ...obj,
    customerId: customer?._id,
    serviceId: service?._id,
    customer: customer ? { name: customer.name, mobile: customer.contacts.find((c) => c.isPrimary)?.mobile ?? customer.contacts[0]?.mobile } : null,
    service: service ? { name: service.name } : null,
    createdByName: createdByUser?.name ?? null,
    customerProduct: customerProduct
      ? {
        brand: customerProduct.brandId?.label,
        productType: customerProduct.productTypeId?.label,
        modelNumber: customerProduct.modelNumber,
        purchaseDate: customerProduct.purchaseDate,
        warrantyExpiresAt: customerProduct.warrantyExpiresAt,
      }
      : null,
    assignee: sr.assigneeType && assigneeName ? { type: sr.assigneeType, name: assigneeName } : null,
  };
}
export async function assertOwnServiceRequestAccess(
  sr: { customerId?: unknown; assigneeType?: unknown; assigneeId?: unknown },
  scope: DataScope,
  user: AccessTokenPayload
): Promise<void> {
  // VENDOR_OWNER/VENDOR_MANAGER get dataScope 'VENDOR' (not 'OWN') on
  // serviceRequests (scripts/seed.ts) — must be checked here too, or a
  // single-record fetch by ID bypasses the vendor-scoping listServiceRequests
  // enforces on the list endpoint.
  if (scope === 'VENDOR' && VENDOR_ROLES_FOR_SCOPE.includes(user.role)) {
    const srAssigneeId = (sr.assigneeId as { toString(): string } | undefined)?.toString();
    if (sr.assigneeType !== 'VENDOR' || !user.vendorId || srAssigneeId !== user.vendorId) {
      throw new NotFoundError('Service request not found');
    }
    return;
  }

  if (scope !== 'OWN') return;

  if (CUSTOMER_ROLES_FOR_SCOPE.includes(user.role)) {
    const ownCustomer = await CustomerModel.findOne({ userId: user.sub }).select('_id');
    const ownId = ownCustomer?._id?.toString();
    const srCustomerId = (sr.customerId as { toString(): string } | undefined)?.toString();
    if (!ownId || srCustomerId !== ownId) {
      throw new NotFoundError('Service request not found');
    }
    return;
  }

  if (EMPLOYEE_ROLES_FOR_SCOPE.includes(user.role)) {
    const srAssigneeId = (sr.assigneeId as { toString(): string } | undefined)?.toString();
    if (sr.assigneeType !== 'EMPLOYEE' || !user.employeeId || srAssigneeId !== user.employeeId) {
      throw new NotFoundError('Service request not found');
    }
    return;
  }

  if (VENDOR_ROLES_FOR_SCOPE.includes(user.role)) {
    const srAssigneeId = (sr.assigneeId as { toString(): string } | undefined)?.toString();
    if (sr.assigneeType !== 'VENDOR' || !user.vendorId || srAssigneeId !== user.vendorId) {
      throw new NotFoundError('Service request not found');
    }
  }
}
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

  if (branch && data.scheduledDate && data.scheduledSlot) {
    await assertSlotAvailable(branch._id.toString(), data.scheduledDate as Date, data.scheduledSlot as string);
  }

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

  await trigger('SERVICE_REQUEST_CREATED', {
    recipient: { customerId: data.customerId as string },
    variables: { serviceRequestId: sr._id.toString(), number },
  });

  return sr;
}

export async function deleteServiceRequest(id: string, actor: AccessTokenPayload) {
  const sr = await ServiceRequestModel.findByIdAndDelete(id);
  if (!sr) throw new NotFoundError('Service request not found');

  await logActivity({
    entityType: 'SERVICE_REQUEST',
    entityId: id,
    user: actor,
    action: 'DELETED',
    module: 'service-requests',
    reason: 'Manual deletion via admin panel',
  });
}

interface StatusChangeMeta {
  reason?: string;
  geo?: { lat: number; lng: number };
}
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
  await trigger(`SERVICE_REQUEST_${toStatus}`, {
    recipient: { customerId: sr.customerId.toString() },
    variables: { serviceRequestId: id, status: toStatus },
  });

  return sr;
}

export function allowedNextStatuses(currentStatus: ServiceRequestStatus): string[] {
  return getAllowedTransitions('SERVICE_REQUEST', currentStatus);
}

interface RescheduleInput {
  scheduledDate: Date;
  scheduledSlot: string;
  reason?: string;
}

// Distinct from updateStatus because this is the one status change that also
// needs to persist new appointment fields, not just flip the status enum —
// scripts/seed.ts only grants CUSTOMER_ROLES the APPOINTMENT_SCHEDULED ->
// RESCHEDULED transition, so this is unreachable from any other status by a
// customer (assertValidTransition still enforces that here).
export async function rescheduleServiceRequest(id: string, input: RescheduleInput, actor: AccessTokenPayload) {
  const sr = await ServiceRequestModel.findById(id);
  if (!sr) throw new NotFoundError('Service request not found');

  assertValidTransition('SERVICE_REQUEST', sr.status, 'RESCHEDULED', actor.role);

  if (sr.branchId) {
    await assertSlotAvailable(sr.branchId.toString(), input.scheduledDate, input.scheduledSlot);
  }

  const fromStatus = sr.status;
  sr.status = 'RESCHEDULED';
  sr.scheduledDate = input.scheduledDate;
  sr.scheduledSlot = input.scheduledSlot;
  await sr.save();

  await logActivity({
    entityType: 'SERVICE_REQUEST',
    entityId: id,
    user: actor,
    action: 'STATUS_CHANGED',
    module: 'service-requests',
    oldValue: { status: fromStatus },
    newValue: { status: 'RESCHEDULED', scheduledDate: input.scheduledDate, scheduledSlot: input.scheduledSlot },
    reason: input.reason,
  });

  emitServiceRequestStatusChanged(id, { serviceRequestId: id, fromStatus, toStatus: 'RESCHEDULED' });
  await trigger('SERVICE_REQUEST_RESCHEDULED', {
    recipient: { customerId: sr.customerId.toString() },
    variables: { serviceRequestId: id, status: 'RESCHEDULED' },
  });

  return sr;
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

  // Only EMPLOYEE assignees resolve directly to a single notifiable User today
  // (via Employee.userId) — BRANCH/SUB_BRANCH/TEAM/VENDOR/OUTSOURCED_PARTNER
  // assignees are organizational units, not individual users, and resolving
  // "who specifically to notify" for those (a branch's on-duty dispatcher? every
  // team member?) is a real design question left open rather than guessed at
  // here; those assignment types simply don't get a direct notification yet.
  if (input.assigneeType === 'EMPLOYEE') {
    const employee = await EmployeeModel.findById(input.assigneeId);
    if (employee) {
      await trigger('SERVICE_REQUEST_ASSIGNED', {
        recipient: { userId: employee.userId.toString() },
        variables: { serviceRequestId: id },
      });
    }
  }

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

// Shared by both the direct-staff path (reopenServiceRequest) and the
// approval path (approveReopenRequest) — everything from computing policy
// eligibility through actually flipping the original SR to REOPENED and
// spawning the linked new one. `existingRecord` is passed by the approval
// path (a PENDING ReopenRecord to fill in and flip to APPROVED); direct
// staff reopens create a fresh already-APPROVED record instead.
async function applyReopen(
  original: InstanceType<typeof ServiceRequestModel>,
  reason: string,
  actor: AccessTokenPayload,
  existingRecord?: InstanceType<typeof ReopenRecordModel>
) {
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
  const reopenCount = existingRecord ? existingRecord.reopenCount : (await ReopenRecordModel.countDocuments({ originalServiceRequestId: rootId })) + 1;

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

  let reopenRecord: InstanceType<typeof ReopenRecordModel>;
  if (existingRecord) {
    existingRecord.newServiceRequestId = newSr._id;
    existingRecord.withinPolicyWindow = withinWindow;
    existingRecord.warrantyApplied = warrantyApplied;
    existingRecord.status = 'APPROVED';
    existingRecord.reviewedBy = actor.sub as never;
    existingRecord.reviewedAt = new Date();
    await existingRecord.save();
    reopenRecord = existingRecord;
  } else {
    reopenRecord = await ReopenRecordModel.create({
      originalServiceRequestId: rootId,
      requestedServiceRequestId: original._id,
      newServiceRequestId: newSr._id,
      reason,
      reopenedBy: actor.sub,
      withinPolicyWindow: withinWindow,
      warrantyApplied,
      reopenCount,
      status: 'APPROVED',
      reviewedBy: actor.sub as never,
      reviewedAt: new Date(),
    });
  }

  await logActivity({
    entityType: 'SERVICE_REQUEST',
    entityId: original._id.toString(),
    user: actor,
    action: 'REOPENED',
    module: 'service-requests',
    reason,
    newValue: { newServiceRequestId: newSr._id, withinPolicyWindow: withinWindow, windowDays, reopenCount, warrantyApplied },
  });

  // Same EMPLOYEE-only resolution caveat as assignServiceRequest() above.
  if (original.assigneeType === 'EMPLOYEE' && original.assigneeId) {
    const employee = await EmployeeModel.findById(original.assigneeId);
    if (employee) {
      await trigger('COMPLAINT_REOPENED', {
        recipient: { userId: employee.userId.toString() },
        variables: { originalServiceRequestId: original._id.toString(), newServiceRequestId: newSr._id.toString() },
      });
    }
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

// Staff-initiated (CALL_EXECUTIVE/ADMIN/SUPER_ADMIN) — applies immediately,
// no separate review step, since staff are already exercising judgment in
// real time (e.g. on a call with the customer). See requestReopen for the
// CUSTOMER-initiated path, which needs CS/Happy-Call sign-off instead.
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

  return applyReopen(original, reason, actor);
}

const REOPEN_REVIEWER_ROLES = ['CUSTOMER_SUPPORT_EXECUTIVE', 'HAPPY_CALL_EXECUTIVE'];

// CUSTOMER-initiated — does NOT touch the original SR or spawn a new one yet;
// just records a PENDING request and notifies reviewers. The CLOSED/PAID ->
// REOPENED transition only actually happens once approveReopenRequest runs.
export async function requestReopen(id: string, reason: string, actor: AccessTokenPayload) {
  const original = await ServiceRequestModel.findById(id);
  if (!original) throw new NotFoundError('Service request not found');
  if (!['CLOSED', 'PAID'].includes(original.status)) {
    throw new ConflictError('Only a closed or paid service request can be reopened', 'REOPEN_NOT_ALLOWED');
  }

  const rootId = await findRootServiceRequestId(original);
  const priorReopenCount = await ReopenRecordModel.countDocuments({ originalServiceRequestId: rootId, status: { $ne: 'REJECTED' } });
  const reopenCount = priorReopenCount + 1;

  const reopenRecord = await ReopenRecordModel.create({
    originalServiceRequestId: rootId,
    requestedServiceRequestId: original._id,
    reason,
    reopenedBy: actor.sub,
    withinPolicyWindow: false, // recomputed properly once approved, per applyReopen
    warrantyApplied: false,
    reopenCount,
    status: 'PENDING',
  });

  await logActivity({
    entityType: 'SERVICE_REQUEST',
    entityId: id,
    user: actor,
    action: 'REOPEN_REQUESTED',
    module: 'service-requests',
    reason,
    newValue: { reopenRequestId: reopenRecord._id.toString() },
  });

  const reviewers = original.branchId
    ? await UserModel.find({ branchId: original.branchId, role: { $in: REOPEN_REVIEWER_ROLES } })
    : await UserModel.find({ role: { $in: ['ADMIN', 'SUPER_ADMIN'] } });
  for (const reviewer of reviewers) {
    await trigger('REOPEN_REQUESTED', {
      recipient: { userId: reviewer._id.toString() },
      variables: { serviceRequestId: id, reason },
    });
  }

  return reopenRecord;
}

async function assertActorOwnsReopenReview(record: IReopenRecord, actor: AccessTokenPayload): Promise<void> {
  if (['ADMIN', 'SUPER_ADMIN'].includes(actor.role)) return;
  if (!REOPEN_REVIEWER_ROLES.includes(actor.role)) {
    throw new AppError(403, 'Only Customer Support / Happy Call staff can review reopen requests', [
      { field: 'general', code: 'FORBIDDEN', message: `Role ${actor.role} cannot review reopen requests` },
    ]);
  }
  if (actor.branchId) {
    const sr = await ServiceRequestModel.findById(record.requestedServiceRequestId).select('branchId');
    if (sr?.branchId && sr.branchId.toString() !== actor.branchId) {
      throw new NotFoundError('Reopen request not found');
    }
  }
}

export async function approveReopenRequest(reopenRequestId: string, actor: AccessTokenPayload) {
  const record = await ReopenRecordModel.findById(reopenRequestId);
  if (!record) throw new NotFoundError('Reopen request not found');
  if (record.status !== 'PENDING') {
    throw new ConflictError('This reopen request has already been reviewed', 'REOPEN_REQUEST_ALREADY_REVIEWED');
  }
  await assertActorOwnsReopenReview(record, actor);

  const original = await ServiceRequestModel.findById(record.requestedServiceRequestId);
  if (!original) throw new NotFoundError('Service request not found');
  if (!['CLOSED', 'PAID'].includes(original.status)) {
    throw new ConflictError('This service request is no longer eligible to be reopened', 'REOPEN_NOT_ALLOWED');
  }
  assertValidTransition('SERVICE_REQUEST', original.status, 'REOPENED', actor.role);

  const result = await applyReopen(original, record.reason, actor, record);

  await trigger('REOPEN_APPROVED', {
    recipient: { customerId: original.customerId.toString() },
    variables: { serviceRequestId: original._id.toString(), newServiceRequestId: result.newServiceRequest._id.toString() },
  });

  return result;
}

export async function rejectReopenRequest(reopenRequestId: string, rejectionReason: string, actor: AccessTokenPayload) {
  const record = await ReopenRecordModel.findById(reopenRequestId);
  if (!record) throw new NotFoundError('Reopen request not found');
  if (record.status !== 'PENDING') {
    throw new ConflictError('This reopen request has already been reviewed', 'REOPEN_REQUEST_ALREADY_REVIEWED');
  }
  await assertActorOwnsReopenReview(record, actor);

  record.status = 'REJECTED';
  record.rejectionReason = rejectionReason;
  record.reviewedBy = actor.sub as never;
  record.reviewedAt = new Date();
  await record.save();

  await logActivity({
    entityType: 'SERVICE_REQUEST',
    entityId: record.requestedServiceRequestId.toString(),
    user: actor,
    action: 'REOPEN_REJECTED',
    module: 'service-requests',
    reason: rejectionReason,
  });

  const original = await ServiceRequestModel.findById(record.requestedServiceRequestId).select('customerId');
  if (original) {
    await trigger('REOPEN_REJECTED', {
      recipient: { customerId: original.customerId.toString() },
      variables: { serviceRequestId: original._id.toString(), reason: rejectionReason },
    });
  }

  return record;
}

export async function getReopenHistory(serviceRequestId: string) {
  const sr = await ServiceRequestModel.findById(serviceRequestId);
  if (!sr) throw new NotFoundError('Service request not found');
  const rootId = await findRootServiceRequestId(sr);
  return ReopenRecordModel.find({ originalServiceRequestId: rootId })
    .populate('reopenedBy', 'name')
    .sort({ reopenedAt: 1 });
}

export async function getAssignmentHistory(serviceRequestId: string) {
  return AssignmentHistoryModel.find({ serviceRequestId })
    .populate('actorId', 'name')
    .sort({ timestamp: -1 });
}

// The real per-request activity feed — every logActivity() call anywhere in
// the app tagged with this SR's id (status changes, estimate/invoice
// actions, reassignments, etc.), not just the narrow assignment-only history
// above. This is what a customer/vendor actually means by "activity
// timeline": the whole story of what happened to their request.
export async function getServiceRequestActivityLog(serviceRequestId: string) {
  const logs = await ActivityLogModel.find({ entityType: 'SERVICE_REQUEST', entityId: serviceRequestId })
    .populate('userId', 'name')
    .sort({ timestamp: -1 })
    .limit(100);

  return logs.map((log) => {
    const user = log.userId as unknown as { name?: string } | undefined;
    return {
      id: log._id.toString(),
      action: log.action,
      actorName: user?.name ?? 'System',
      reason: log.reason,
      timestamp: log.timestamp.toISOString(),
    };
  });
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

  // Fixed only in development so field testing does not depend on a delivery
  // provider. Production continues to use a cryptographically random OTP.
  const otp = env.nodeEnv === 'production' ? generateOtp() : '123456';
  await OtpModel.create({
    mobile,
    otpHash: hashOtp(otp),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  if (env.nodeEnv !== 'production') {
    console.log(`[dev] Completion OTP for job ${serviceRequestId} (${mobile}): ${otp}`);
  }

  await trigger('SERVICE_COMPLETION_OTP', { recipient: { mobile }, variables: { serviceRequestId, otp } });
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
