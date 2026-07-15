import { Response, NextFunction } from 'express';
import * as aiService from './ai.service';
import { sendSuccess } from '../../lib/apiResponse';
import { ScopedRequest } from '../../middleware/permission.middleware';
import { UnauthorizedError } from '../../lib/errors';

export async function getSettingsHandler(_req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const settings = await aiService.getSettings();
    sendSuccess(res, settings, 'AI settings fetched successfully');
  } catch (err) {
    next(err);
  }
}

export async function updateSettingsHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const settings = await aiService.updateSettings(req.body);
    sendSuccess(res, settings, 'AI settings updated successfully');
  } catch (err) {
    next(err);
  }
}

export async function summarizeCallHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const result = await aiService.summarizeCall(req.body, req.user);
    sendSuccess(res, result, 'AI summarization request processed');
  } catch (err) {
    next(err);
  }
}

export async function classifyComplaintHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const result = await aiService.classifyComplaint(req.body, req.user);
    sendSuccess(res, result, 'AI classification request processed');
  } catch (err) {
    next(err);
  }
}
