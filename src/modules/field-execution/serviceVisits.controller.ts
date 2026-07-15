import { Response, NextFunction } from 'express';
import * as visitService from './serviceVisits.service';
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

export async function updateInspectionHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const visit = await visitService.updateInspection(paramAsString(req.params.id), req.user.sub, req.body);
    sendSuccess(res, visit, 'Inspection updated successfully');
  } catch (err) {
    next(err);
  }
}

export async function addPartsHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const { parts } = req.body as { parts: never[] };
    const visit = await visitService.addParts(paramAsString(req.params.id), req.user.sub, parts);
    sendSuccess(res, visit, 'Parts added successfully', null, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateWorkHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const visit = await visitService.updateWork(paramAsString(req.params.id), req.user.sub, req.body);
    sendSuccess(res, visit, 'Work progress updated successfully');
  } catch (err) {
    next(err);
  }
}

export async function completeVisitHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const { completionProof } = req.body as { completionProof: never };
    const visit = await visitService.completeVisit(paramAsString(req.params.id), req.user.sub, completionProof);
    sendSuccess(res, visit, 'Visit marked complete successfully');
  } catch (err) {
    next(err);
  }
}

export async function syncBatchHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const { actions } = req.body as { actions: never[] };
    const results = await visitService.processSyncBatch(paramAsString(req.params.id), actions, req.user);
    sendSuccess(res, results, 'Sync batch processed');
  } catch (err) {
    next(err);
  }
}
