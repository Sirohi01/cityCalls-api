import { Response, NextFunction } from 'express';
import * as srService from './serviceRequests.service';
import { rankAssignmentCandidates } from '../../lib/assignmentEngine';
import { sendSuccess, paramAsString } from '../../lib/apiResponse';
import { ScopedRequest } from '../../middleware/permission.middleware';
import { UnauthorizedError, InvalidTransitionError } from '../../lib/errors';
import { ServiceRequestStatus } from './serviceRequests.model';

export async function listServiceRequestsHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const { items, meta } = await srService.listServiceRequests(req.query as never);
    sendSuccess(res, items, 'Service requests fetched successfully', meta);
  } catch (err) {
    next(err);
  }
}

export async function getServiceRequestHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const sr = await srService.getServiceRequest(paramAsString(req.params.id));
    sendSuccess(res, sr, 'Service request fetched successfully');
  } catch (err) {
    next(err);
  }
}

export async function createServiceRequestHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const sr = await srService.createServiceRequest(req.body, req.user.sub);
    sendSuccess(res, sr, 'Service request created successfully', null, 201);
  } catch (err) {
    next(err);
  }
}

// Per docs/07-status-transition-matrix.md and docs/18-error-handling-standards.md §2:
// an invalid transition returns 409 with the current status and the actual
// allowed-next-statuses list, so the client can recover instead of guessing.
export async function changeStatusHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const { toStatus, reason, geo } = req.body as { toStatus: ServiceRequestStatus; reason?: string; geo?: { lat: number; lng: number } };
    try {
      const sr = await srService.updateStatus(paramAsString(req.params.id), toStatus, req.user, { reason, geo });
      sendSuccess(res, sr, 'Service request status updated successfully');
    } catch (err) {
      if (err instanceof InvalidTransitionError) {
        const sr = await srService.getServiceRequest(paramAsString(req.params.id));
        res.status(409).json({
          success: false,
          message: err.message,
          data: { currentStatus: sr.status, allowedTransitions: srService.allowedNextStatuses(sr.status) },
          errors: err.errors,
        });
        return;
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

export async function assignHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const sr = await srService.assignServiceRequest(paramAsString(req.params.id), req.body, req.user);
    sendSuccess(res, sr, 'Service request assigned successfully');
  } catch (err) {
    next(err);
  }
}

export async function reassignHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const sr = await srService.assignServiceRequest(paramAsString(req.params.id), req.body, req.user);
    sendSuccess(res, sr, 'Service request reassigned successfully');
  } catch (err) {
    next(err);
  }
}

export async function cancelHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const { reason } = req.body as { reason: string };
    const sr = await srService.cancelServiceRequest(paramAsString(req.params.id), reason, req.user);
    sendSuccess(res, sr, 'Service request cancelled successfully');
  } catch (err) {
    next(err);
  }
}

export async function reopenHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const { reason } = req.body as { reason: string };
    const result = await srService.reopenServiceRequest(paramAsString(req.params.id), reason, req.user);
    sendSuccess(res, result, 'Service request reopened successfully', null, 201);
  } catch (err) {
    next(err);
  }
}

export async function assignmentHistoryHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const history = await srService.getAssignmentHistory(paramAsString(req.params.id));
    sendSuccess(res, history, 'Assignment history fetched successfully');
  } catch (err) {
    next(err);
  }
}

export async function assignmentCandidatesHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const candidates = await rankAssignmentCandidates(paramAsString(req.params.id));
    sendSuccess(res, candidates, 'Assignment candidates ranked successfully');
  } catch (err) {
    next(err);
  }
}
