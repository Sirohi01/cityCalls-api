import { VendorInvoiceModel, VendorPayoutModel } from './vendorFinance.model';
import { VendorModel } from './vendors.model';
import { NotFoundError } from '../../lib/errors';
import { buildPaginationMeta } from '../../lib/apiResponse';
import { getNextNumber } from '../../lib/numbering';
import { logActivity } from '../../lib/auditLog';
import { AccessTokenPayload } from '../../lib/jwt';

interface CreateVendorInvoiceInput {
  vendorId: string;
  serviceRequestIds: string[];
  grossAmount: number;
  periodStart?: Date;
  periodEnd?: Date;
}

// Commission computed from the vendor's own configured commissionModel
// (docs/09-database-architecture.md §2 "vendors" schema) — a flat rate for v1;
// per-service commission tables are a documented extension point, not built yet.
export async function createVendorInvoice(input: CreateVendorInvoiceInput, actor: AccessTokenPayload) {
  const vendor = await VendorModel.findById(input.vendorId);
  if (!vendor) throw new NotFoundError('Vendor not found');

  const commissionRate = vendor.commissionRate ?? 0;
  const commissionAmount = Math.round(((input.grossAmount * commissionRate) / 100) * 100) / 100;
  const netPayable = Math.round((input.grossAmount - commissionAmount) * 100) / 100;

  const number = await getNextNumber('VENDOR_INVOICE');
  const invoice = await VendorInvoiceModel.create({
    number,
    vendorId: input.vendorId,
    serviceRequestIds: input.serviceRequestIds,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    amount: netPayable,
    commissionBreakup: { grossAmount: input.grossAmount, commissionRate, commissionAmount, netPayable },
  });

  await logActivity({
    entityType: 'VENDOR_INVOICE',
    entityId: invoice._id.toString(),
    user: actor,
    action: 'CREATED',
    module: 'vendors',
    newValue: { vendorId: input.vendorId, netPayable },
  });

  return invoice;
}

export async function listVendorInvoices(params: { page: number; limit: number; vendorId?: string; status?: string }) {
  const filter: Record<string, unknown> = {};
  if (params.vendorId) filter.vendorId = params.vendorId;
  if (params.status) filter.status = params.status;

  const skip = (params.page - 1) * params.limit;
  const [items, total] = await Promise.all([
    VendorInvoiceModel.find(filter).skip(skip).limit(params.limit).sort({ createdAt: -1 }),
    VendorInvoiceModel.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta(params.page, params.limit, total) };
}

export async function approveVendorInvoice(id: string, actor: AccessTokenPayload) {
  const invoice = await VendorInvoiceModel.findById(id);
  if (!invoice) throw new NotFoundError('Vendor invoice not found');
  invoice.status = 'APPROVED';
  await invoice.save();
  await logActivity({ entityType: 'VENDOR_INVOICE', entityId: id, user: actor, action: 'APPROVED', module: 'vendors' });
  return invoice;
}

interface CreatePayoutInput {
  vendorId: string;
  vendorInvoiceIds: string[];
}

export async function createVendorPayout(input: CreatePayoutInput, actor: AccessTokenPayload) {
  const invoices = await VendorInvoiceModel.find({ _id: { $in: input.vendorInvoiceIds }, vendorId: input.vendorId });
  if (invoices.length === 0) throw new NotFoundError('No matching approved vendor invoices found');

  const amount = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const number = await getNextNumber('VENDOR_PAYOUT');

  const payout = await VendorPayoutModel.create({
    number,
    vendorId: input.vendorId,
    vendorInvoiceIds: input.vendorInvoiceIds,
    amount,
  });

  await logActivity({
    entityType: 'VENDOR_PAYOUT',
    entityId: payout._id.toString(),
    user: actor,
    action: 'CREATED',
    module: 'vendors',
    newValue: { vendorId: input.vendorId, amount },
  });

  return payout;
}

export async function markPayoutPaid(id: string, reference: string, actor: AccessTokenPayload) {
  const payout = await VendorPayoutModel.findById(id);
  if (!payout) throw new NotFoundError('Vendor payout not found');

  payout.status = 'PAID';
  payout.paidAt = new Date();
  payout.reference = reference;
  await payout.save();

  await VendorInvoiceModel.updateMany({ _id: { $in: payout.vendorInvoiceIds } }, { status: 'PAID' });

  await logActivity({ entityType: 'VENDOR_PAYOUT', entityId: id, user: actor, action: 'PAID', module: 'vendors', reason: reference });
  return payout;
}

export async function listVendorPayouts(params: { page: number; limit: number; vendorId?: string; status?: string }) {
  const filter: Record<string, unknown> = {};
  if (params.vendorId) filter.vendorId = params.vendorId;
  if (params.status) filter.status = params.status;

  const skip = (params.page - 1) * params.limit;
  const [items, total] = await Promise.all([
    VendorPayoutModel.find(filter).skip(skip).limit(params.limit).sort({ createdAt: -1 }),
    VendorPayoutModel.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta(params.page, params.limit, total) };
}
