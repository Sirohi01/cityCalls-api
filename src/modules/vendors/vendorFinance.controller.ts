import { Response, NextFunction } from 'express';
import * as vendorFinanceService from './vendorFinance.service';
import { sendSuccess, paramAsString } from '../../lib/apiResponse';
import { ScopedRequest } from '../../middleware/permission.middleware';
import { UnauthorizedError } from '../../lib/errors';

export async function createVendorInvoiceHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const invoice = await vendorFinanceService.createVendorInvoice(req.body, req.user);
    sendSuccess(res, invoice, 'Vendor invoice created successfully', null, 201);
  } catch (err) {
    next(err);
  }
}

export async function listVendorInvoicesHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const { items, meta } = await vendorFinanceService.listVendorInvoices(req.query as never);
    sendSuccess(res, items, 'Vendor invoices fetched successfully', meta);
  } catch (err) {
    next(err);
  }
}

export async function approveVendorInvoiceHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const invoice = await vendorFinanceService.approveVendorInvoice(paramAsString(req.params.id), req.user);
    sendSuccess(res, invoice, 'Vendor invoice approved successfully');
  } catch (err) {
    next(err);
  }
}

export async function createVendorPayoutHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const payout = await vendorFinanceService.createVendorPayout(req.body, req.user);
    sendSuccess(res, payout, 'Vendor payout created successfully', null, 201);
  } catch (err) {
    next(err);
  }
}

export async function markPayoutPaidHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const { reference } = req.body as { reference: string };
    const payout = await vendorFinanceService.markPayoutPaid(paramAsString(req.params.id), reference, req.user);
    sendSuccess(res, payout, 'Vendor payout marked paid successfully');
  } catch (err) {
    next(err);
  }
}

export async function listVendorPayoutsHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const { items, meta } = await vendorFinanceService.listVendorPayouts(req.query as never);
    sendSuccess(res, items, 'Vendor payouts fetched successfully', meta);
  } catch (err) {
    next(err);
  }
}
