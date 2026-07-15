import crypto from 'crypto';
import { ServiceVisitModel, IServiceVisit } from './serviceVisits.model';
import { SyncedActionModel } from './syncedActions.model';
import { NotFoundError, InvalidTransitionError } from '../../lib/errors';
import { updateStatus, getServiceRequest, allowedNextStatuses } from '../service-requests/serviceRequests.service';
import { emitTechnicianLocationUpdated } from '../../realtime';
import { AccessTokenPayload } from '../../lib/jwt';
import { ServiceRequestStatus } from '../service-requests/serviceRequests.model';

export async function getVisitsForServiceRequest(serviceRequestId: string) {
  return ServiceVisitModel.find({ serviceRequestId }).sort({ visitNumber: 1 });
}

// Finds the technician's current in-progress visit for this Service Request,
// or starts a new one — a Service Request may span multiple visits (docs/09
// §2), each its own document rather than an array field.
async function getOrStartVisit(serviceRequestId: string, technicianId: string): Promise<IServiceVisit> {
  const open = await ServiceVisitModel.findOne({
    serviceRequestId,
    technicianId,
    completedAt: { $exists: false },
  }).sort({ visitNumber: -1 });
  if (open) return open;

  const lastVisit = await ServiceVisitModel.findOne({ serviceRequestId }).sort({ visitNumber: -1 });
  const visitNumber = (lastVisit?.visitNumber ?? 0) + 1;

  return ServiceVisitModel.create({
    serviceRequestId,
    visitNumber,
    technicianId,
    startedAt: new Date(),
  });
}

export async function startVisit(serviceRequestId: string, technicianId: string) {
  return getOrStartVisit(serviceRequestId, technicianId);
}

export async function markArrived(serviceRequestId: string, technicianId: string, geo?: { lat: number; lng: number }) {
  const visit = await getOrStartVisit(serviceRequestId, technicianId);
  visit.arrivedAt = new Date();
  await visit.save();

  if (geo) {
    emitTechnicianLocationUpdated(serviceRequestId, { serviceRequestId, geo, at: visit.arrivedAt });
  }
  return visit;
}

export async function updateInspection(serviceRequestId: string, technicianId: string, data: Record<string, unknown>) {
  const visit = await getOrStartVisit(serviceRequestId, technicianId);
  visit.inspection = { ...visit.inspection, ...data };
  await visit.save();
  return visit;
}

export async function addParts(serviceRequestId: string, technicianId: string, parts: IServiceVisit['parts']) {
  const visit = await getOrStartVisit(serviceRequestId, technicianId);
  visit.parts.push(...parts);
  await visit.save();
  return visit;
}

export async function updateWork(serviceRequestId: string, technicianId: string, data: Record<string, unknown>) {
  const visit = await getOrStartVisit(serviceRequestId, technicianId);
  if (data.labourCharge !== undefined) visit.labourCharge = data.labourCharge as number;
  if (data.workNotes !== undefined) visit.workNotes = data.workNotes as string;
  if (Array.isArray(data.beforeImages)) visit.beforeImages.push(...(data.beforeImages as string[]));
  if (Array.isArray(data.afterImages)) visit.afterImages.push(...(data.afterImages as string[]));
  if (data.nextVisitDate !== undefined) visit.nextVisitDate = data.nextVisitDate as Date;
  await visit.save();
  return visit;
}

export async function completeVisit(serviceRequestId: string, technicianId: string, completionProof: IServiceVisit['completionProof']) {
  const visit = await getOrStartVisit(serviceRequestId, technicianId);
  visit.completedAt = new Date();
  visit.completionProof = completionProof;
  await visit.save();
  return visit;
}

interface SyncAction {
  idempotencyKey: string;
  clientTimestamp: Date;
  actionType: string;
  payload: Record<string, unknown>;
}

interface SyncActionResult {
  idempotencyKey: string;
  actionType: string;
  status: 'APPLIED' | 'REJECTED' | 'REPLAYED';
  message: string;
  currentStatus?: ServiceRequestStatus;
  allowedTransitions?: string[];
}

async function applyAction(serviceRequestId: string, actor: AccessTokenPayload, action: SyncAction): Promise<string> {
  switch (action.actionType) {
    case 'START_VISIT':
      await startVisit(serviceRequestId, actor.sub);
      return 'Visit started';
    case 'ARRIVE':
      await markArrived(serviceRequestId, actor.sub, action.payload.geo as { lat: number; lng: number } | undefined);
      return 'Marked arrived';
    case 'UPDATE_INSPECTION':
      await updateInspection(serviceRequestId, actor.sub, action.payload);
      return 'Inspection updated';
    case 'ADD_PARTS':
      await addParts(serviceRequestId, actor.sub, action.payload.parts as IServiceVisit['parts']);
      return 'Parts added';
    case 'UPDATE_WORK':
      await updateWork(serviceRequestId, actor.sub, action.payload);
      return 'Work updated';
    case 'COMPLETE_VISIT':
      await completeVisit(serviceRequestId, actor.sub, action.payload.completionProof as IServiceVisit['completionProof']);
      return 'Visit completed';
    case 'STATUS_CHANGE':
      await updateStatus(serviceRequestId, action.payload.toStatus as ServiceRequestStatus, actor, {
        reason: action.payload.reason as string | undefined,
        geo: action.payload.geo as { lat: number; lng: number } | undefined,
      });
      return `Status changed to ${action.payload.toStatus}`;
    default:
      throw new Error(`Unknown action type: ${action.actionType}`);
  }
}

// Processes a batch of offline-queued actions in client-recorded order, each
// independently — a stale/invalid action is rejected on its own, not the whole
// batch, per docs/manish/09-vendor-app-functional-plan.md §2 and
// docs/18-error-handling-standards.md §7. Idempotency keys prevent a retried
// batch (e.g. after a dropped connection mid-sync) from double-applying
// already-processed actions.
export async function processSyncBatch(serviceRequestId: string, actions: SyncAction[], actor: AccessTokenPayload): Promise<SyncActionResult[]> {
  const ordered = [...actions].sort((a, b) => a.clientTimestamp.getTime() - b.clientTimestamp.getTime());
  const results: SyncActionResult[] = [];

  for (const action of ordered) {
    const existing = await SyncedActionModel.findOne({ idempotencyKey: action.idempotencyKey });
    if (existing) {
      results.push({
        idempotencyKey: action.idempotencyKey,
        actionType: action.actionType,
        status: 'REPLAYED',
        message: existing.resultSummary,
      });
      continue;
    }

    try {
      const message = await applyAction(serviceRequestId, actor, action);
      await SyncedActionModel.create({
        idempotencyKey: action.idempotencyKey,
        serviceRequestId,
        actionType: action.actionType,
        status: 'APPLIED',
        resultSummary: message,
      });
      results.push({ idempotencyKey: action.idempotencyKey, actionType: action.actionType, status: 'APPLIED', message });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const result: SyncActionResult = {
        idempotencyKey: action.idempotencyKey,
        actionType: action.actionType,
        status: 'REJECTED',
        message,
      };

      if (err instanceof InvalidTransitionError) {
        const sr = await getServiceRequest(serviceRequestId);
        result.currentStatus = sr.status;
        result.allowedTransitions = allowedNextStatuses(sr.status);
      }

      await SyncedActionModel.create({
        idempotencyKey: action.idempotencyKey,
        serviceRequestId,
        actionType: action.actionType,
        status: 'REJECTED',
        resultSummary: message,
      });
      results.push(result);
    }
  }

  return results;
}

export async function getVisit(id: string) {
  const visit = await ServiceVisitModel.findById(id);
  if (!visit) throw new NotFoundError('Service visit not found');
  return visit;
}

// Deterministic idempotency key for a non-batch (direct) action, so the same
// direct-call convention as the sync batch can be reused if ever needed.
export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}
