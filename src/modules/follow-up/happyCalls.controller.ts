import { Response, NextFunction } from 'express';
import * as happyCallsService from './happyCalls.service';
import { sendSuccess, paramAsString } from '../../lib/apiResponse';
import { ScopedRequest } from '../../middleware/permission.middleware';
import { UnauthorizedError } from '../../lib/errors';

export async function listHappyCallsHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const { items, meta } = await happyCallsService.listHappyCalls(req.query as never);
    sendSuccess(res, items, 'Happy calls fetched successfully', meta);
  } catch (err) {
    next(err);
  }
}

export async function listReopenRequestsHandler(_req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const mockReopens = [
      { id: 'RR-001', requestNumber: 'SR-2023-089', customerName: 'Rajesh Kumar', reason: 'Issue reoccurred after 2 days', status: 'PENDING', requestedAt: new Date().toISOString() },
      { id: 'RR-002', requestNumber: 'SR-2023-042', customerName: 'Sneha Gupta', reason: 'Technician left without testing', status: 'APPROVED', requestedAt: new Date(Date.now() - 86400000).toISOString() },
    ];
    
    res.status(200).json({
      success: true,
      message: 'Reopen requests retrieved',
      data: mockReopens,
      meta: null,
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

export async function getHappyCallHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const happyCall = await happyCallsService.getHappyCall(paramAsString(req.params.id));
    sendSuccess(res, happyCall, 'Happy call fetched successfully');
  } catch (err) {
    next(err);
  }
}

export async function recordOutcomeHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const happyCall = await happyCallsService.recordOutcome(paramAsString(req.params.id), req.body, req.user);
    sendSuccess(res, happyCall, 'Happy call outcome recorded successfully');
  } catch (err) {
    next(err);
  }
}

export async function reassignHappyCallHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const { assignedTo } = req.body as { assignedTo: string };
    const happyCall = await happyCallsService.reassignHappyCall(paramAsString(req.params.id), assignedTo, req.user);
    sendSuccess(res, happyCall, 'Happy call reassigned successfully');
  } catch (err) {
    next(err);
  }
}
