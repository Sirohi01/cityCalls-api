import { Response, NextFunction } from 'express';
import * as srService from './serviceRequests.service';
import * as happyCallsService from '../follow-up/happyCalls.service';
import { rankAssignmentCandidates } from '../../lib/assignmentEngine';
import { sendSuccess, paramAsString } from '../../lib/apiResponse';
import { ScopedRequest } from '../../middleware/permission.middleware';
import { UnauthorizedError, InvalidTransitionError } from '../../lib/errors';
import { ServiceRequestStatus } from './serviceRequests.model';

export async function listServiceRequestsHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || !req.scope) throw new UnauthorizedError();
    const { items, meta } = await srService.listServiceRequests(req.query as never, req.scope, req.user);
    sendSuccess(res, items, 'Service requests fetched successfully', meta);
  } catch (err) {
    next(err);
  }
}

export async function getServiceRequestHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || !req.scope) throw new UnauthorizedError();
    const sr = await srService.getServiceRequest(paramAsString(req.params.id));
    await srService.assertOwnServiceRequestAccess(sr, req.scope, req.user);
    sendSuccess(res, sr, 'Service request fetched successfully');
  } catch (err) {
    next(err);
  }
}

// Per docs/rohit/05-customer-app-screen-list.md "Feedback" — deliberately
// reuses getServiceRequest + assertOwnServiceRequestAccess (the same
// ownership check as the read path) rather than a new check, so this can
// never be called against someone else's request.
export async function submitFeedbackHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || !req.scope) throw new UnauthorizedError();
    const id = paramAsString(req.params.id);
    const sr = await srService.getServiceRequest(id);
    await srService.assertOwnServiceRequestAccess(sr, req.scope, req.user);
    const { rating, remarks } = req.body as { rating: number; remarks?: string };
    const result = await happyCallsService.submitCustomerFeedback(id, rating, remarks);
    sendSuccess(res, result, 'Feedback submitted successfully', null, 201);
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

export async function deleteServiceRequestHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || !req.scope) throw new UnauthorizedError();
    const id = paramAsString(req.params.id);
    const sr = await srService.getServiceRequest(id);
    await srService.assertOwnServiceRequestAccess(sr, req.scope, req.user);
    await srService.deleteServiceRequest(id, req.user);
    sendSuccess(res, null, 'Service request deleted successfully');
  } catch (err) {
    next(err);
  }
}
export async function changeStatusHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || !req.scope) throw new UnauthorizedError();
    const id = paramAsString(req.params.id);
    const existing = await srService.getServiceRequest(id);
    await srService.assertOwnServiceRequestAccess(existing, req.scope, req.user);
    const { toStatus, reason, geo } = req.body as { toStatus: ServiceRequestStatus; reason?: string; geo?: { lat: number; lng: number } };
    try {
      const sr = await srService.updateStatus(id, toStatus, req.user, { reason, geo });
      sendSuccess(res, sr, 'Service request status updated successfully');
    } catch (err) {
      if (err instanceof InvalidTransitionError) {
        const sr = await srService.getServiceRequest(id);
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

export async function rescheduleHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || !req.scope) throw new UnauthorizedError();
    const id = paramAsString(req.params.id);
    const existing = await srService.getServiceRequest(id);
    await srService.assertOwnServiceRequestAccess(existing, req.scope, req.user);
    const { scheduledDate, scheduledSlot, reason } = req.body as { scheduledDate: Date; scheduledSlot: string; reason?: string };
    try {
      const sr = await srService.rescheduleServiceRequest(id, { scheduledDate, scheduledSlot, reason }, req.user);
      sendSuccess(res, sr, 'Service request rescheduled successfully');
    } catch (err) {
      if (err instanceof InvalidTransitionError) {
        res.status(409).json({
          success: false,
          message: err.message,
          data: { currentStatus: existing.status, allowedTransitions: srService.allowedNextStatuses(existing.status) },
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
    if (!req.user || !req.scope) throw new UnauthorizedError();
    const id = paramAsString(req.params.id);
    const existing = await srService.getServiceRequest(id);
    await srService.assertOwnServiceRequestAccess(existing, req.scope, req.user);
    const { reason } = req.body as { reason: string };
    const sr = await srService.cancelServiceRequest(id, reason, req.user);
    sendSuccess(res, sr, 'Service request cancelled successfully');
  } catch (err) {
    next(err);
  }
}

export async function reopenHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || !req.scope) throw new UnauthorizedError();
    const id = paramAsString(req.params.id);
    const existing = await srService.getServiceRequest(id);
    await srService.assertOwnServiceRequestAccess(existing, req.scope, req.user);
    const { reason } = req.body as { reason: string };
    const result = await srService.reopenServiceRequest(id, reason, req.user);
    sendSuccess(res, result, 'Service request reopened successfully', null, 201);
  } catch (err) {
    next(err);
  }
}

export async function reopenHistoryHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const history = await srService.getReopenHistory(paramAsString(req.params.id));
    sendSuccess(res, history, 'Reopen history fetched successfully');
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

export async function requestCompletionOtpHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    await srService.requestCompletionOtp(paramAsString(req.params.id));
    sendSuccess(res, null, 'Completion OTP sent successfully');
  } catch (err) {
    next(err);
  }
}

export async function verifyCompletionOtpHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const { otp } = req.body as { otp: string };
    const result = await srService.verifyCompletionOtp(paramAsString(req.params.id), otp);
    sendSuccess(res, result, 'Completion OTP verified successfully');
  } catch (err) {
    next(err);
  }
}

export async function locationPingHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const { lat, lng } = req.body as { lat: number; lng: number };
    await srService.recordLocationPing(paramAsString(req.params.id), { lat, lng });
    sendSuccess(res, null, 'Location ping recorded');
  } catch (err) {
    next(err);
  }
}
