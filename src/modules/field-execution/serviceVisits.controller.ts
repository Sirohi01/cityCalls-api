import { Response, NextFunction } from 'express';
import * as visitService from './serviceVisits.service';
import { getServiceRequest, assertOwnServiceRequestAccess } from '../service-requests/serviceRequests.service';
import { sendSuccess, paramAsString } from '../../lib/apiResponse';
import { ScopedRequest } from '../../middleware/permission.middleware';
import { UnauthorizedError } from '../../lib/errors';

export async function listVisitsHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const visits = await visitService.getVisitsForServiceRequest(paramAsString(req.params.id));
    sendSuccess(res, visits, 'Service visits fetched successfully');
  } catch (err) {
    next(err);
  }
}

// Every mutation below acts on a specific Service Request by ID — without
// this check, any actor with fieldExecution:edit (any scope) could act on a
// job that was never assigned to them (a real gap this fixes, not specific
// to any one role: OWN-scope EMPLOYEE/TECHNICIAN/VENDOR_TECHNICIAN callers
// all need it, and it's a no-op for BRANCH/ALL-scope staff).
async function assertCanActOnServiceRequest(req: ScopedRequest, id: string): Promise<void> {
  if (!req.user || !req.scope) throw new UnauthorizedError();
  const sr = await getServiceRequest(id);
  await assertOwnServiceRequestAccess(sr, req.scope, req.user);
}

export async function updateInspectionHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const id = paramAsString(req.params.id);
    await assertCanActOnServiceRequest(req, id);
    const visit = await visitService.updateInspection(id, req.user.sub, req.body);
    sendSuccess(res, visit, 'Inspection updated successfully');
  } catch (err) {
    next(err);
  }
}

export async function addPartsHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const id = paramAsString(req.params.id);
    await assertCanActOnServiceRequest(req, id);
    const { parts } = req.body as { parts: never[] };
    const visit = await visitService.addParts(id, req.user.sub, parts);
    sendSuccess(res, visit, 'Parts added successfully', null, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateWorkHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const id = paramAsString(req.params.id);
    await assertCanActOnServiceRequest(req, id);
    const visit = await visitService.updateWork(id, req.user.sub, req.body);
    sendSuccess(res, visit, 'Work progress updated successfully');
  } catch (err) {
    next(err);
  }
}

export async function completeVisitHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const id = paramAsString(req.params.id);
    await assertCanActOnServiceRequest(req, id);
    const { completionProof } = req.body as { completionProof: never };
    const visit = await visitService.completeVisit(id, req.user.sub, completionProof);
    sendSuccess(res, visit, 'Visit marked complete successfully');
  } catch (err) {
    next(err);
  }
}

export async function syncBatchHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const id = paramAsString(req.params.id);
    await assertCanActOnServiceRequest(req, id);
    const { actions } = req.body as { actions: never[] };
    const results = await visitService.processSyncBatch(id, actions, req.user);
    sendSuccess(res, results, 'Sync batch processed');
  } catch (err) {
    next(err);
  }
}
