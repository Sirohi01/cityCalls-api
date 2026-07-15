import { EstimateModel } from './estimates.model';
import { BranchModel } from '../organization/organization.model';
import { CustomerModel } from '../customers/customers.model';
import { NotFoundError, ConflictError } from '../../lib/errors';
import { buildPaginationMeta } from '../../lib/apiResponse';
import { getNextNumber, currentFinancialYear } from '../../lib/numbering';
import { computeDocumentTotals } from '../../lib/financialTotals';
import { assertValidTransition } from '../../lib/statusEngine';
import { generateDocumentPdf } from '../../lib/pdfGenerator';
import { sendPlaceholderNotification } from '../../lib/notificationStub';
import { logActivity } from '../../lib/auditLog';
import { AccessTokenPayload } from '../../lib/jwt';

interface LineItemInput {
  description: string;
  partId?: string;
  qty: number;
  unitPrice: number;
  taxRateId?: string;
}

interface CreateEstimateInput {
  customerId: string;
  branchId: string;
  serviceRequestId?: string;
  leadId?: string;
  items: LineItemInput[];
  discount?: number;
  validUntil?: Date;
}

// Resolves the two state names GST calculation needs: the branch's own
// registered state and the customer's billing/service address state.
async function resolveGstStates(branchId: string, customerId: string): Promise<{ branchState: string; customerState: string }> {
  const [branch, customer] = await Promise.all([BranchModel.findById(branchId), CustomerModel.findById(customerId)]);
  const branchState = branch?.registeredAddress?.state ?? '';
  const customerAddress = customer?.addresses.find((a) => a.isDefault) ?? customer?.addresses[0];
  const customerState = customerAddress?.state ?? branchState; // no address on file -> assume intra-state rather than block document creation
  return { branchState, customerState };
}

export async function createEstimate(input: CreateEstimateInput, actor: AccessTokenPayload) {
  const { branchState, customerState } = await resolveGstStates(input.branchId, input.customerId);
  const totals = await computeDocumentTotals(input.items, input.discount ?? 0, branchState, customerState);

  const number = await getNextNumber('ESTIMATE', input.branchId);

  const estimate = await EstimateModel.create({
    number,
    serviceRequestId: input.serviceRequestId,
    leadId: input.leadId,
    customerId: input.customerId,
    branchId: input.branchId,
    financialYear: currentFinancialYear(),
    items: totals.items,
    subtotal: totals.subtotal,
    taxBreakup: totals.taxBreakup,
    discount: input.discount ?? 0,
    roundOff: totals.roundOff,
    total: totals.total,
    validUntil: input.validUntil,
  });

  await logActivity({
    entityType: 'ESTIMATE',
    entityId: estimate._id.toString(),
    user: actor,
    action: 'CREATED',
    module: 'finance',
    newValue: { number, total: totals.total },
  });

  return estimate;
}

export async function listEstimates(params: { page: number; limit: number; status?: string; customerId?: string; serviceRequestId?: string }) {
  const filter: Record<string, unknown> = {};
  if (params.status) filter.status = params.status;
  if (params.customerId) filter.customerId = params.customerId;
  if (params.serviceRequestId) filter.serviceRequestId = params.serviceRequestId;

  const skip = (params.page - 1) * params.limit;
  const [items, total] = await Promise.all([
    EstimateModel.find(filter).skip(skip).limit(params.limit).sort({ createdAt: -1 }),
    EstimateModel.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta(params.page, params.limit, total) };
}

export async function getEstimate(id: string) {
  const estimate = await EstimateModel.findById(id);
  if (!estimate) throw new NotFoundError('Estimate not found');
  return estimate;
}

export async function shareEstimate(id: string, channels: string[], actor: AccessTokenPayload) {
  const estimate = await EstimateModel.findById(id);
  if (!estimate) throw new NotFoundError('Estimate not found');

  assertValidTransition('ESTIMATE', estimate.status, 'SHARED', actor.role);

  estimate.pdfUrl = await generateDocumentPdf('ESTIMATE', id);
  estimate.status = 'SHARED';
  estimate.sentVia = channels;
  await estimate.save();

  sendPlaceholderNotification({
    to: estimate.customerId.toString(),
    purpose: 'ESTIMATE_SHARED',
    payload: { estimateId: id, number: estimate.number, total: estimate.total },
  });

  return estimate;
}

export async function respondToEstimate(id: string, approve: boolean, actor: AccessTokenPayload) {
  const estimate = await EstimateModel.findById(id);
  if (!estimate) throw new NotFoundError('Estimate not found');

  const toStatus = approve ? 'APPROVED' : 'REJECTED';
  assertValidTransition('ESTIMATE', estimate.status, toStatus, actor.role);

  estimate.status = toStatus;
  if (approve) {
    estimate.approvedBy = actor.sub as never;
    estimate.approvedAt = new Date();
  }
  await estimate.save();

  await logActivity({
    entityType: 'ESTIMATE',
    entityId: id,
    user: actor,
    action: approve ? 'APPROVED' : 'REJECTED',
    module: 'finance',
  });

  return estimate;
}

// A rejected/expired Estimate never silently becomes usable data elsewhere —
// conversion is a distinct, auditable step (docs/16-pdf-and-financial-documents.md,
// conversion chain diagram).
export async function assertConvertible(id: string) {
  const estimate = await EstimateModel.findById(id);
  if (!estimate) throw new NotFoundError('Estimate not found');
  if (estimate.status !== 'APPROVED') {
    throw new ConflictError('Only an approved estimate can be converted', 'ESTIMATE_NOT_APPROVED');
  }
  return estimate;
}

export async function markConverted(id: string, actor: AccessTokenPayload) {
  const estimate = await EstimateModel.findById(id);
  if (!estimate) throw new NotFoundError('Estimate not found');
  assertValidTransition('ESTIMATE', estimate.status, 'CONVERTED', actor.role);
  estimate.status = 'CONVERTED';
  await estimate.save();
}

export { resolveGstStates };
