import { HappyCallModel } from './happyCalls.model';
import { ServiceRequestModel } from '../service-requests/serviceRequests.model';
import { updateStatus } from '../service-requests/serviceRequests.service';
import { NotFoundError, ConflictError } from '../../lib/errors';
import { buildPaginationMeta } from '../../lib/apiResponse';
import { logActivity } from '../../lib/auditLog';
import { sendPlaceholderNotification } from '../../lib/notificationStub';
import { AccessTokenPayload } from '../../lib/jwt';

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
    HappyCallModel.find(filter).skip(skip).limit(params.limit).sort({ createdAt: -1 }),
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
      sendPlaceholderNotification({
        to: sr.branchId?.toString() ?? 'unassigned',
        purpose: 'HAPPY_CALL_ESCALATION',
        payload: { serviceRequestId: sr._id.toString(), remarks: input.remarks },
      });
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
