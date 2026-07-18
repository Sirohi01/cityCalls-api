import { HappyCallModel } from './happyCalls.model';
import { ReopenRecordModel } from './reopenRecords.model';
import { ServiceRequestModel } from '../service-requests/serviceRequests.model';
import { updateStatus } from '../service-requests/serviceRequests.service';
import { NotFoundError, ConflictError } from '../../lib/errors';
import { buildPaginationMeta } from '../../lib/apiResponse';
import { logActivity } from '../../lib/auditLog';
import { trigger } from '../../lib/notifications';
import { UserModel } from '../users/users.model';
import { AccessTokenPayload } from '../../lib/jwt';

interface ReopenRequestListItem {
  id: string;
  originalServiceRequestId: string;
  requestNumber?: string;
  customerName: string;
  reason: string;
  status: 'COMPLETED'; // a reopen is applied immediately (serviceRequests.service.ts's reopenServiceRequest) —
  // there is no pending-approval state in this system's workflow, unlike the fields' original mock data implied.
  reopenedAt: string;
}

// Cross-cutting admin view over every reopen, across all service requests —
// distinct from GET /service-requests/{id}/reopen-history, which is scoped
// to one request's own chain.
export async function listAllReopenRequests(params: { page: number; limit: number }): Promise<{
  items: ReopenRequestListItem[];
  meta: ReturnType<typeof buildPaginationMeta>;
}> {
  const skip = (params.page - 1) * params.limit;
  const [records, total] = await Promise.all([
    ReopenRecordModel.find()
      .sort({ reopenedAt: -1 })
      .skip(skip)
      .limit(params.limit)
      .populate({
        path: 'originalServiceRequestId',
        select: 'number customerId',
        populate: { path: 'customerId', select: 'name' },
      }),
    ReopenRecordModel.countDocuments(),
  ]);

  const items: ReopenRequestListItem[] = records.map((r) => {
    const sr = r.originalServiceRequestId as unknown as { _id: { toString(): string }; number?: string; customerId?: { name?: string } };
    return {
      id: r._id.toString(),
      originalServiceRequestId: sr?._id?.toString() ?? r.originalServiceRequestId.toString(),
      requestNumber: sr?.number,
      customerName: sr?.customerId?.name ?? 'Unknown',
      reason: r.reason,
      status: 'COMPLETED',
      reopenedAt: r.reopenedAt.toISOString(),
    };
  });

  return { items, meta: buildPaginationMeta(params.page, params.limit, total) };
}

const MAX_UNREACHABLE_RETRIES = 2; // docs/06-complete-workflow-document.md Stage 10: "2 retries over 5 days before giving up"

export async function scheduleHappyCall(serviceRequestId: string, assignedTo: string) {
  const existing = await HappyCallModel.findOne({ serviceRequestId });
  if (existing) return existing;

  return HappyCallModel.create({ serviceRequestId, assignedTo });
}

export async function listHappyCalls(params: { page: number; limit: number; status?: string; assignedTo?: string }) {
  const filter: Record<string, unknown> = {};
  if (params.status) filter.status = params.status;
  if (params.assignedTo) filter.assignedTo = params.assignedTo;

  const skip = (params.page - 1) * params.limit;
  const [items, total] = await Promise.all([
    HappyCallModel.find(filter)
      .populate('serviceRequestId', 'number')
      .populate('assignedTo', 'name')
      .skip(skip)
      .limit(params.limit)
      .sort({ createdAt: -1 }),
    HappyCallModel.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta(params.page, params.limit, total) };
}

export async function getHappyCall(id: string) {
  const happyCall = await HappyCallModel.findById(id);
  if (!happyCall) throw new NotFoundError('Happy call not found');
  return happyCall;
}

interface OutcomeInput {
  status: 'PENDING' | 'COMPLETED' | 'UNREACHABLE' | 'RESCHEDULED';
  outcome?: string;
  customerSatisfaction?: number;
  remarks?: string;
  reopenRequested: boolean;
  escalationRequired: boolean;
  nextFollowUpDate?: Date;
  recordingUrl?: string;
}

// Per docs/06-complete-workflow-document.md Stage 10: outcome recording drives
// the linked Service Request's terminal transition (HAPPY_CALL_PENDING ->
// CLOSED), flags escalation, and surfaces reopen intent for staff to action
// separately through the dedicated reopen endpoint (this never auto-reopens —
// that's still an explicit, auditable staff/customer action).
export async function recordOutcome(id: string, input: OutcomeInput, actor: AccessTokenPayload) {
  const happyCall = await HappyCallModel.findById(id);
  if (!happyCall) throw new NotFoundError('Happy call not found');
  if (happyCall.status === 'COMPLETED') {
    throw new ConflictError('This happy call has already been completed', 'HAPPY_CALL_ALREADY_COMPLETED');
  }

  if (input.status === 'UNREACHABLE') {
    happyCall.retryCount += 1;
    happyCall.status = happyCall.retryCount > MAX_UNREACHABLE_RETRIES ? 'COMPLETED' : 'UNREACHABLE';
    happyCall.outcome = happyCall.retryCount > MAX_UNREACHABLE_RETRIES ? 'UNREACHABLE_CLOSED_AFTER_RETRIES' : 'UNREACHABLE';
  } else {
    happyCall.status = input.status;
    happyCall.outcome = input.outcome;
  }

  happyCall.callDate = new Date();
  happyCall.performedBy = actor.sub as never;
  happyCall.customerSatisfaction = input.customerSatisfaction;
  happyCall.remarks = input.remarks;
  happyCall.reopenRequested = input.reopenRequested;
  happyCall.escalationRequired = input.escalationRequired;
  happyCall.nextFollowUpDate = input.nextFollowUpDate;
  happyCall.recordingUrl = input.recordingUrl;
  await happyCall.save();

  await logActivity({
    entityType: 'HAPPY_CALL',
    entityId: id,
    user: actor,
    action: 'OUTCOME_RECORDED',
    module: 'follow-up',
    newValue: { status: happyCall.status, reopenRequested: input.reopenRequested, escalationRequired: input.escalationRequired },
  });

  // Reached a terminal outcome (genuinely completed, or gave up after retries) — close the linked Service Request.
  if (happyCall.status === 'COMPLETED') {
    const sr = await ServiceRequestModel.findById(happyCall.serviceRequestId);
    if (sr && sr.status === 'HAPPY_CALL_PENDING') {
      await updateStatus(happyCall.serviceRequestId.toString(), 'CLOSED', actor, {
        reason: `Happy call completed: ${happyCall.outcome ?? 'no outcome recorded'}`,
      });
    }

    if (input.escalationRequired && sr) {
      sr.isEscalated = true;
      sr.escalationReason = `Happy call flagged dissatisfaction: ${input.remarks ?? ''}`;
      await sr.save();

      const branchManagers = sr.branchId
        ? await UserModel.find({ branchId: sr.branchId, role: { $in: ['BRANCH_MANAGER', 'ADMIN', 'SUPER_ADMIN'] } })
        : await UserModel.find({ role: { $in: ['ADMIN', 'SUPER_ADMIN'] } });
      for (const manager of branchManagers) {
        await trigger('HAPPY_CALL_ESCALATION', {
          recipient: { userId: manager._id.toString() },
          variables: { serviceRequestId: sr._id.toString(), remarks: input.remarks ?? '' },
        });
      }
    }
  }

  return happyCall;
}

export async function reassignHappyCall(id: string, assignedTo: string, actor: AccessTokenPayload) {
  const happyCall = await HappyCallModel.findById(id);
  if (!happyCall) throw new NotFoundError('Happy call not found');

  happyCall.assignedTo = assignedTo as never;
  await happyCall.save();

  await logActivity({ entityType: 'HAPPY_CALL', entityId: id, user: actor, action: 'REASSIGNED', module: 'follow-up' });
  return happyCall;
}
