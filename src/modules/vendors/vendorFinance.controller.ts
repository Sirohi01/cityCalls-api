import { Response, NextFunction } from 'express';
import * as vendorFinanceService from './vendorFinance.service';
import { sendSuccess, paramAsString } from '../../lib/apiResponse';
import { ScopedRequest } from '../../middleware/permission.middleware';
import { UnauthorizedError, ForbiddenError } from '../../lib/errors';

// VENDOR_OWNER/VENDOR_MANAGER hold 'viewFinancial' on the vendors module
// (scripts/seed.ts, so they can see their own invoices/payouts below), but
// the actual billing/approval/payout actions must stay admin/finance-only —
// otherwise a vendor could invoice itself an arbitrary amount, approve its
// own invoice, and mark its own payout paid. Scope match alone doesn't prove
// authorization to *author* these records, only that a record is about them.
const VENDOR_SELF_SERVICE_ROLES = ['VENDOR_OWNER', 'VENDOR_MANAGER', 'VENDOR_TECHNICIAN'];
function assertNotVendorSelfService(req: ScopedRequest): void {
  if (req.user && VENDOR_SELF_SERVICE_ROLES.includes(req.user.role)) {
    throw new ForbiddenError('Vendor accounts cannot create or settle their own invoices/payouts');
  }
}

export async function createVendorInvoiceHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    assertNotVendorSelfService(req);
    const invoice = await vendorFinanceService.createVendorInvoice(req.body, req.user);
    sendSuccess(res, invoice, 'Vendor invoice created successfully', null, 201);
  } catch (err) {
    next(err);
  }
}

export async function listVendorInvoicesHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || !req.scope) throw new UnauthorizedError();
    const params = req.query as unknown as { page: number; limit: number; vendorId?: string | null; status?: string };
    // A vendor-scoped caller can only ever see their own invoices, regardless
    // of what (if anything) they passed as ?vendorId — same reasoning as
    // listServiceRequests' OWN/VENDOR scope handling. null (not a bogus
    // string) keeps this a safe empty-result Mongo query, not a CastError,
    // if a vendor role somehow has no vendorId on its token.
    if (req.scope === 'VENDOR') params.vendorId = req.user.vendorId ?? null;
    const { items, meta } = await vendorFinanceService.listVendorInvoices(params);
    sendSuccess(res, items, 'Vendor invoices fetched successfully', meta);
  } catch (err) {
    next(err);
  }
}

export async function approveVendorInvoiceHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    assertNotVendorSelfService(req);
    const invoice = await vendorFinanceService.approveVendorInvoice(paramAsString(req.params.id), req.user);
    sendSuccess(res, invoice, 'Vendor invoice approved successfully');
  } catch (err) {
    next(err);
  }
}

export async function createVendorPayoutHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    assertNotVendorSelfService(req);
    const payout = await vendorFinanceService.createVendorPayout(req.body, req.user);
    sendSuccess(res, payout, 'Vendor payout created successfully', null, 201);
  } catch (err) {
    next(err);
  }
}

export async function markPayoutPaidHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    assertNotVendorSelfService(req);
    const { reference } = req.body as { reference: string };
    const payout = await vendorFinanceService.markPayoutPaid(paramAsString(req.params.id), reference, req.user);
    sendSuccess(res, payout, 'Vendor payout marked paid successfully');
  } catch (err) {
    next(err);
  }
}

export async function listVendorPayoutsHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || !req.scope) throw new UnauthorizedError();
    const params = req.query as unknown as { page: number; limit: number; vendorId?: string | null; status?: string };
    if (req.scope === 'VENDOR') params.vendorId = req.user.vendorId ?? null;
    const { items, meta } = await vendorFinanceService.listVendorPayouts(params);
    sendSuccess(res, items, 'Vendor payouts fetched successfully', meta);
  } catch (err) {
    next(err);
  }
}
