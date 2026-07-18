import { Response, NextFunction } from 'express';
import * as callService from './calls.service';
import { sendSuccess, paramAsString } from '../../lib/apiResponse';
import { ScopedRequest } from '../../middleware/permission.middleware';
import { UnauthorizedError } from '../../lib/errors';

export async function listCallsHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || !req.scope) throw new UnauthorizedError();
    const { items, meta } = await callService.listCalls(req.query as never, req.scope, req.user);
    sendSuccess(res, items, 'Calls fetched successfully', meta);
  } catch (err) {
    next(err);
  }
}

export async function getCallHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const call = await callService.getCall(paramAsString(req.params.id));
    sendSuccess(res, call, 'Call fetched successfully');
  } catch (err) {
    next(err);
  }
}

export async function createCallHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const call = await callService.createCall(req.body, req.user.sub);
    sendSuccess(res, call, 'Call logged successfully', null, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateCallHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const call = await callService.updateCall(paramAsString(req.params.id), req.body);
    sendSuccess(res, call, 'Call updated successfully');
  } catch (err) {
    next(err);
  }
}
