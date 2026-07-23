import { Response, NextFunction } from 'express';
import * as campaignsService from './campaigns.service';
import { sendSuccess, paramAsString } from '../../lib/apiResponse';
import { ScopedRequest } from '../../middleware/permission.middleware';
import { UnauthorizedError } from '../../lib/errors';

export async function createCampaignHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const campaign = await campaignsService.createCampaign(req.body, req.user);
    sendSuccess(res, campaign, 'Campaign created successfully', null, 201);
  } catch (err) {
    next(err);
  }
}

export async function listCampaignsHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const { items, meta } = await campaignsService.listCampaigns(req.query as never);
    sendSuccess(res, items, 'Campaigns fetched successfully', meta);
  } catch (err) {
    next(err);
  }
}

export async function getCampaignHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const campaign = await campaignsService.getCampaign(paramAsString(req.params.id));
    sendSuccess(res, campaign, 'Campaign fetched successfully');
  } catch (err) {
    next(err);
  }
}

export async function sendCampaignHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const campaign = await campaignsService.sendCampaignNow(paramAsString(req.params.id), req.user);
    sendSuccess(res, campaign, 'Campaign sent successfully');
  } catch (err) {
    next(err);
  }
}

export async function updateCampaignHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const campaign = await campaignsService.updateCampaign(paramAsString(req.params.id), req.body);
    sendSuccess(res, campaign, 'Campaign updated successfully');
  } catch (err) {
    next(err);
  }
}

export async function deleteCampaignHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    await campaignsService.deleteCampaign(paramAsString(req.params.id));
    sendSuccess(res, null, 'Campaign deleted successfully');
  } catch (err) {
    next(err);
  }
}
