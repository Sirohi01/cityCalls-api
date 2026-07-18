import { ProformaInvoiceModel } from './proformaInvoices.model';
import * as estimatesService from './estimates.service';
import { NotFoundError, ConflictError } from '../../lib/errors';
import { buildPaginationMeta } from '../../lib/apiResponse';
import { getNextNumber, currentFinancialYear } from '../../lib/numbering';
import { assertValidTransition } from '../../lib/statusEngine';
import { generateDocumentPdf } from '../../lib/pdfGenerator';
import { trigger } from '../../lib/notifications';
import { logActivity } from '../../lib/auditLog';
import { AccessTokenPayload } from '../../lib/jwt';
import { DataScope } from '../users/users.types';

// Conversion: Lead -> Estimate -> Proforma Invoice -> Service Request -> Invoice
// -> Payment Receipt (docs/16-pdf-and-financial-documents.md). Converting carries
// items/totals forward exactly as approved — it never re-derives them, since the
// approved Estimate is the customer's actual agreement.
export async function convertEstimateToProforma(estimateId: string, actor: AccessTokenPayload) {
  const estimate = await estimatesService.assertConvertible(estimateId);

  const number = await getNextNumber('PROFORMA_INVOICE', estimate.branchId.toString());
  const proforma = await ProformaInvoiceModel.create({
    number,
    serviceRequestId: estimate.serviceRequestId,
    leadId: estimate.leadId,
    customerId: estimate.customerId,
    branchId: estimate.branchId,
    financialYear: currentFinancialYear(),
    items: estimate.items,
    subtotal: estimate.subtotal,
    taxBreakup: estimate.taxBreakup,
    discount: estimate.discount,
    roundOff: estimate.roundOff,
    total: estimate.total,
    estimateId: estimate._id,
  });

  await estimatesService.markConverted(estimateId, actor);

  await logActivity({
    entityType: 'PROFORMA_INVOICE',
    entityId: proforma._id.toString(),
    user: actor,
    action: 'CREATED_FROM_ESTIMATE',
    module: 'finance',
    newValue: { estimateId, number },
  });

  return proforma;
}

export async function listProformaInvoices(
  params: { page: number; limit: number; status?: string; customerId?: string },
  scope: DataScope,
  user: AccessTokenPayload
) {
  const filter: Record<string, unknown> = {};
  if (params.status) filter.status = params.status;
  if (params.customerId) filter.customerId = params.customerId;
  if (scope === 'BRANCH' && user.branchId) filter.branchId = user.branchId;

  const skip = (params.page - 1) * params.limit;
  const [items, total] = await Promise.all([
    ProformaInvoiceModel.find(filter).skip(skip).limit(params.limit).sort({ createdAt: -1 }),
    ProformaInvoiceModel.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta(params.page, params.limit, total) };
}

export async function getProformaInvoice(id: string) {
  const proforma = await ProformaInvoiceModel.findById(id);
  if (!proforma) throw new NotFoundError('Proforma invoice not found');
  return proforma;
}

export async function shareProformaInvoice(id: string, channels: string[], actor: AccessTokenPayload) {
  const proforma = await ProformaInvoiceModel.findById(id);
  if (!proforma) throw new NotFoundError('Proforma invoice not found');

  assertValidTransition('PROFORMA_INVOICE', proforma.status, 'SHARED', actor.role);
  proforma.pdfUrl = await generateDocumentPdf('PROFORMA_INVOICE', id);
  proforma.status = 'SHARED';
  proforma.sentVia = channels;
  await proforma.save();

  await trigger('PROFORMA_INVOICE_SHARED', {
    recipient: { customerId: proforma.customerId.toString() },
    variables: { proformaInvoiceId: id, number: proforma.number },
  });

  return proforma;
}

export async function acceptProformaInvoice(id: string, actor: AccessTokenPayload) {
  const proforma = await ProformaInvoiceModel.findById(id);
  if (!proforma) throw new NotFoundError('Proforma invoice not found');

  assertValidTransition('PROFORMA_INVOICE', proforma.status, 'ACCEPTED', actor.role);
  proforma.status = 'ACCEPTED';
  proforma.approvedBy = actor.sub as never;
  proforma.approvedAt = new Date();
  await proforma.save();
  return proforma;
}

export async function assertConvertible(id: string) {
  const proforma = await ProformaInvoiceModel.findById(id);
  if (!proforma) throw new NotFoundError('Proforma invoice not found');
  if (proforma.status !== 'ACCEPTED') {
    throw new ConflictError('Only an accepted proforma invoice can be converted', 'PROFORMA_NOT_ACCEPTED');
  }
  return proforma;
}

export async function markConverted(id: string, actor: AccessTokenPayload) {
  const proforma = await ProformaInvoiceModel.findById(id);
  if (!proforma) throw new NotFoundError('Proforma invoice not found');
  assertValidTransition('PROFORMA_INVOICE', proforma.status, 'CONVERTED', actor.role);
  proforma.status = 'CONVERTED';
  await proforma.save();
}
