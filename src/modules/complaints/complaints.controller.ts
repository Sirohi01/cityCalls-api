import { Response, NextFunction } from 'express';
import * as complaintsService from './complaints.service';
import { sendSuccess, paramAsString } from '../../lib/apiResponse';
import { ScopedRequest } from '../../middleware/permission.middleware';
import { UnauthorizedError } from '../../lib/errors';
import { ComplaintStatus } from './complaints.model';

export async function listComplaintsHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || !req.scope) throw new UnauthorizedError();
    const { items, meta } = await complaintsService.listComplaints(req.query as never, req.scope, req.user);
    sendSuccess(res, items, 'Complaints fetched successfully', meta);
  } catch (err) {
    next(err);
  }
}

export async function getComplaintHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || !req.scope) throw new UnauthorizedError();
    const complaint = await complaintsService.getComplaint(paramAsString(req.params.id));
    await complaintsService.assertOwnComplaintAccess(complaint, req.scope, req.user);
    sendSuccess(res, complaint, 'Complaint fetched successfully');
  } catch (err) {
    next(err);
  }
}

export async function createComplaintHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const { serviceRequestId, subject, description } = req.body as { serviceRequestId?: string; subject: string; description: string };
    const complaint = await complaintsService.createComplaint({ serviceRequestId, subject, description }, req.user);
    sendSuccess(res, complaint, 'Complaint submitted successfully', null, 201);
  } catch (err) {
    next(err);
  }
}

export async function respondComplaintHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const { response, status } = req.body as { response: string; status: 'RESOLVED' | 'CLOSED' };
    const complaint = await complaintsService.respondToComplaint(paramAsString(req.params.id), response, status, req.user);
    sendSuccess(res, complaint, 'Response submitted successfully');
  } catch (err) {
    next(err);
  }
}

export async function updateComplaintStatusHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const { status } = req.body as { status: ComplaintStatus };
    const complaint = await complaintsService.updateComplaintStatus(paramAsString(req.params.id), status, req.user);
    sendSuccess(res, complaint, 'Complaint status updated successfully');
  } catch (err) {
    next(err);
  }
}
