import { Response, NextFunction } from 'express';
import * as leadService from './leads.service';
import { sendSuccess, paramAsString } from '../../lib/apiResponse';
import { ScopedRequest } from '../../middleware/permission.middleware';
import { UnauthorizedError } from '../../lib/errors';

export async function listLeadsHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || !req.scope) throw new UnauthorizedError();
    const { items, meta } = await leadService.listLeads(req.query as never, req.scope, req.user);
    sendSuccess(res, items, 'Leads fetched successfully', meta);
  } catch (err) {
    next(err);
  }
}

export async function getLeadHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const lead = await leadService.getLead(paramAsString(req.params.id));
    sendSuccess(res, lead, 'Lead fetched successfully');
  } catch (err) {
    next(err);
  }
}

export async function createLeadHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const lead = await leadService.createLead(req.body);
    sendSuccess(res, lead, 'Lead created successfully', null, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateLeadHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const lead = await leadService.updateLead(paramAsString(req.params.id), req.body);
    sendSuccess(res, lead, 'Lead updated successfully');
  } catch (err) {
    next(err);
  }
}

export async function changeStageHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const { toStage, lostReason } = req.body as { toStage: string; lostReason?: string };
    const lead = await leadService.changeStage(paramAsString(req.params.id), toStage, lostReason, req.user);
    sendSuccess(res, lead, 'Lead stage updated successfully');
  } catch (err) {
    next(err);
  }
}

export async function addNoteHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const { text } = req.body as { text: string };
    const lead = await leadService.addNote(paramAsString(req.params.id), text, req.user.sub);
    sendSuccess(res, lead, 'Note added successfully', null, 201);
  } catch (err) {
    next(err);
  }
}

export async function convertLeadHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const result = await leadService.convertLead(paramAsString(req.params.id), req.body as never, req.user);
    sendSuccess(res, result, 'Lead converted successfully');
  } catch (err) {
    next(err);
  }
}

export async function bulkAssignHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const { leadIds, ownerId } = req.body as { leadIds: string[]; ownerId: string };
    const result = await leadService.bulkAssign(leadIds, ownerId);
    sendSuccess(res, result, 'Leads reassigned successfully');
  } catch (err) {
    next(err);
  }
}

export async function mergeLeadsHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const { primaryLeadId, duplicateLeadId } = req.body as { primaryLeadId: string; duplicateLeadId: string };
    const result = await leadService.mergeLeads(primaryLeadId, duplicateLeadId);
    sendSuccess(res, result, 'Leads merged successfully');
  } catch (err) {
    next(err);
  }
}

export async function deleteLeadHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    await leadService.deleteLead(paramAsString(req.params.id));
    sendSuccess(res, null, 'Lead deleted successfully');
  } catch (err) {
    next(err);
  }
}
