import { InvoiceModel } from './invoices.model';
import * as proformaService from './proformaInvoices.service';
import { resolveGstStates } from './estimates.service';
import { computeDocumentTotals } from '../../lib/financialTotals';
import { NotFoundError, ConflictError } from '../../lib/errors';
import { buildPaginationMeta } from '../../lib/apiResponse';
import { getNextNumber, currentFinancialYear } from '../../lib/numbering';
import { assertValidTransition } from '../../lib/statusEngine';
import { generateDocumentPdf } from '../../lib/pdfGenerator';
import { trigger } from '../../lib/notifications';
import { logActivity } from '../../lib/auditLog';
import { AccessTokenPayload } from '../../lib/jwt';
import { DataScope } from '../users/users.types';
import { isCustomerRole, resolveOwnCustomerId } from '../../lib/ownCustomerScope';

export async function convertProformaToInvoice(proformaId: string, actor: AccessTokenPayload) {
  const proforma = await proformaService.assertConvertible(proformaId);

  const number = await getNextNumber('INVOICE', proforma.branchId.toString());
  const invoice = await InvoiceModel.create({
    number,
    serviceRequestId: proforma.serviceRequestId,
    leadId: proforma.leadId,
    customerId: proforma.customerId,
    branchId: proforma.branchId,
    financialYear: currentFinancialYear(),
    items: proforma.items,
    subtotal: proforma.subtotal,
    taxBreakup: proforma.taxBreakup,
    discount: proforma.discount,
    roundOff: proforma.roundOff,
    total: proforma.total,
    proformaInvoiceId: proforma._id,
    status: 'ISSUED',
  });

  await proformaService.markConverted(proformaId, actor);

  await logActivity({
    entityType: 'INVOICE',
    entityId: invoice._id.toString(),
    user: actor,
    action: 'CREATED_FROM_PROFORMA',
    module: 'finance',
    newValue: { proformaInvoiceId: proformaId, number },
  });

  return invoice;
}

interface LineItemInput {
  description: string;
  partId?: string;
  qty: number;
  unitPrice: number;
  taxRateId?: string;
}

interface CreateDirectInvoiceInput {
  customerId: string;
  branchId: string;
  serviceRequestId?: string;
  items: LineItemInput[];
  discount?: number;
}

// For services where no estimate/proforma stage occurred (docs/16 §1: "or
// generated fresh if no estimate stage occurred").
export async function createDirectInvoice(input: CreateDirectInvoiceInput, actor: AccessTokenPayload) {
  const { branchState, customerState } = await resolveGstStates(input.branchId, input.customerId);
  const totals = await computeDocumentTotals(input.items, input.discount ?? 0, branchState, customerState);

  const number = await getNextNumber('INVOICE', input.branchId);
  const invoice = await InvoiceModel.create({
    number,
    serviceRequestId: input.serviceRequestId,
    customerId: input.customerId,
    branchId: input.branchId,
    financialYear: currentFinancialYear(),
    items: totals.items,
    subtotal: totals.subtotal,
    taxBreakup: totals.taxBreakup,
    discount: input.discount ?? 0,
    roundOff: totals.roundOff,
    total: totals.total,
    status: 'ISSUED',
  });

  await logActivity({
    entityType: 'INVOICE',
    entityId: invoice._id.toString(),
    user: actor,
    action: 'CREATED_DIRECT',
    module: 'finance',
    newValue: { number, total: totals.total },
  });

  return invoice;
}

export async function listInvoices(
  params: { page: number; limit: number; status?: string; customerId?: string; serviceRequestId?: string },
  scope: DataScope,
  user: AccessTokenPayload
) {
  const filter: Record<string, unknown> = {};
  if (params.status) filter.status = params.status;
  if (params.customerId) filter.customerId = params.customerId;
  if (params.serviceRequestId) filter.serviceRequestId = params.serviceRequestId;
  if (scope === 'BRANCH' && user.branchId) filter.branchId = user.branchId;
  // Same fix as estimates.service.ts's listEstimates — CUSTOMER/BUSINESS_CUSTOMER's
  // OWN scope was previously unenforced here.
  if (scope === 'OWN' && isCustomerRole(user.role)) {
    const ownId = await resolveOwnCustomerId(user.sub);
    filter.customerId = ownId ?? null;
  }

  const skip = (params.page - 1) * params.limit;
  const [items, total] = await Promise.all([
    InvoiceModel.find(filter).skip(skip).limit(params.limit).sort({ createdAt: -1 }),
    InvoiceModel.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta(params.page, params.limit, total) };
}

export async function getInvoice(id: string, actor?: AccessTokenPayload) {
  const invoice = await InvoiceModel.findById(id);
  if (!invoice) throw new NotFoundError('Invoice not found');
  if (actor && isCustomerRole(actor.role)) {
    const ownId = await resolveOwnCustomerId(actor.sub);
    if (!ownId || invoice.customerId.toString() !== ownId) throw new NotFoundError('Invoice not found');
  }
  return invoice;
}

export async function shareInvoice(id: string, channels: string[]) {
  const invoice = await InvoiceModel.findById(id);
  if (!invoice) throw new NotFoundError('Invoice not found');

  invoice.pdfUrl = await generateDocumentPdf('INVOICE', id);
  invoice.sentVia = channels;
  await invoice.save();

  await trigger('INVOICE_GENERATED', {
    recipient: { customerId: invoice.customerId.toString() },
    variables: { invoiceId: id, number: invoice.number, total: invoice.total },
  });

  return invoice;
}

// Per docs/16-pdf-and-financial-documents.md §4: cancellable only before any
// payment is recorded. After a payment exists, corrections go through
// Credit/Debit Notes instead (creditDebitNotes.service.ts) — this function
// enforces that boundary rather than trusting the caller to check first.
export async function cancelInvoice(id: string, reason: string, actor: AccessTokenPayload) {
  const invoice = await InvoiceModel.findById(id);
  if (!invoice) throw new NotFoundError('Invoice not found');

  if (invoice.amountPaid > 0) {
    throw new ConflictError(
      'Cannot cancel an invoice with payments recorded against it — issue a credit note instead',
      'INVOICE_HAS_PAYMENTS'
    );
  }

  assertValidTransition('INVOICE', invoice.status, 'CANCELLED', actor.role);
  invoice.status = 'CANCELLED';
  invoice.cancelledAt = new Date();
  invoice.cancelReason = reason;
  await invoice.save();

  await logActivity({
    entityType: 'INVOICE',
    entityId: id,
    user: actor,
    action: 'CANCELLED',
    module: 'finance',
    reason,
  });

  return invoice;
}
