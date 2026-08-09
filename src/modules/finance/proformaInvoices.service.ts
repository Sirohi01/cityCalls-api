import { ProformaInvoiceModel } from './proformaInvoices.model';
import { EstimateModel } from './estimates.model';
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
  params: { page: number; limit: number; status?: string; customerId?: string; serviceRequestId?: string },
  scope: DataScope,
  user: AccessTokenPayload
) {
  const filter: Record<string, unknown> = {};
  if (params.status) filter.status = params.status;
  if (params.customerId) filter.customerId = params.customerId;
  if (params.serviceRequestId) filter.serviceRequestId = params.serviceRequestId;
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
export async function generateProformaFromServiceRequest(serviceRequestId: string, actor: AccessTokenPayload) {
  const existing = await ProformaInvoiceModel.findOne({ serviceRequestId, status: { $ne: 'CONVERTED' } }).sort({ createdAt: -1 });
  if (existing) return existing;

  const estimate = await EstimateModel.findOne({ serviceRequestId, status: 'APPROVED' }).sort({ approvedAt: -1 });
  if (!estimate) {
    throw new NotFoundError('No approved estimate found for this service request');
  }

  const proforma = await convertEstimateToProforma(estimate._id.toString(), actor);
  return shareProformaInvoice(proforma._id.toString(), ['IN_APP'], actor);
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
