import { LeadModel } from './leads.model';
import { CustomerModel } from '../customers/customers.model';
import { createServiceRequest } from '../service-requests/serviceRequests.service';
import { NotFoundError, ConflictError, ForbiddenError } from '../../lib/errors';
import { buildPaginationMeta } from '../../lib/apiResponse';
import { getNextNumber } from '../../lib/numbering';
import { assertValidTransition } from '../../lib/statusEngine';
import { logActivity } from '../../lib/auditLog';
import { AccessTokenPayload } from '../../lib/jwt';
import { applyScopeFilter } from '../../lib/scopeFilter';
import { DataScope } from '../users/users.types';

interface ListParams {
  page: number;
  limit: number;
  stage?: string;
  ownerId?: string;
  source?: string;
  priority?: string;
  q?: string;
}

export async function listLeads(params: ListParams, scope: DataScope, user: AccessTokenPayload) {
  let filter: Record<string, unknown> = {};
  if (params.stage) filter.stage = params.stage;
  if (params.ownerId) filter.ownerId = params.ownerId;
  if (params.source) filter.source = params.source;
  if (params.priority) filter.priority = params.priority;
  if (params.q) {
    filter.$or = [
      { number: { $regex: params.q, $options: 'i' } },
      { contactName: { $regex: params.q, $options: 'i' } },
      { contactMobile: { $regex: params.q, $options: 'i' } },
    ];
  }
  filter = applyScopeFilter(filter, scope, user, 'ownerId');

  const skip = (params.page - 1) * params.limit;
  const [items, total] = await Promise.all([
    LeadModel.find(filter).skip(skip).limit(params.limit).sort({ createdAt: -1 }),
    LeadModel.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta(params.page, params.limit, total) };
}

export async function getLead(id: string) {
  const lead = await LeadModel.findById(id);
  if (!lead) throw new NotFoundError('Lead not found');
  return lead;
}

export async function createLead(data: Record<string, unknown>) {
  const number = await getNextNumber('LEAD', data.branchId as string | undefined);
  return LeadModel.create({ ...data, number, stage: 'NEW' });
}

export async function updateLead(id: string, data: Record<string, unknown>) {
  const lead = await LeadModel.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  if (!lead) throw new NotFoundError('Lead not found');
  return lead;
}

// Roles that may act on ANY lead regardless of ownership (privileged override,
// per docs/05-user-roles-and-permissions.md §6). Every other role must actually
// own the lead — the status_transitions table only checks "is this role allowed
// to make this stage change at all," not "is this specific record theirs,"
// so per-record ownership is enforced here as a second, narrower check matching
// the "Owner" actor column in docs/07-status-transition-matrix.md §3.
const STAGE_CHANGE_OVERRIDE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'OPERATIONS_ADMIN'];

export async function changeStage(id: string, toStage: string, lostReason: string | undefined, actor: AccessTokenPayload) {
  const lead = await LeadModel.findById(id);
  if (!lead) throw new NotFoundError('Lead not found');

  assertValidTransition('LEAD', lead.stage, toStage, actor.role);

  if (!STAGE_CHANGE_OVERRIDE_ROLES.includes(actor.role) && lead.ownerId.toString() !== actor.sub) {
    throw new ForbiddenError('Only the lead owner or a manager can change this lead\'s stage');
  }

  const fromStage = lead.stage;
  lead.stage = toStage as typeof lead.stage;
  if (toStage === 'LOST') lead.lostReason = lostReason;
  await lead.save();

  await logActivity({
    entityType: 'LEAD',
    entityId: id,
    user: actor,
    action: 'STAGE_CHANGED',
    module: 'leads',
    oldValue: { stage: fromStage },
    newValue: { stage: toStage },
  });

  return lead;
}

export async function addNote(id: string, text: string, authorId: string) {
  const lead = await LeadModel.findByIdAndUpdate(
    id,
    { $push: { notes: { text, authorId, createdAt: new Date() } } },
    { new: true }
  );
  if (!lead) throw new NotFoundError('Lead not found');
  return lead;
}

interface AddressSnapshotInput {
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pinCode: string;
  country: string;
}

interface ConvertInput {
  convertTo: 'CUSTOMER' | 'SERVICE_REQUEST';
  customerType: string;
  name?: string;
  addresses: AddressSnapshotInput[];
  serviceId?: string;
  addressSnapshot?: AddressSnapshotInput;
  symptoms: string[];
}

async function convertLeadToCustomer(lead: InstanceType<typeof LeadModel>, input: ConvertInput) {
  if (lead.customerId) return CustomerModel.findById(lead.customerId);

  return CustomerModel.create({
    customerType: input.customerType,
    name: input.name ?? lead.contactName ?? 'Unknown',
    contacts: lead.contactMobile ? [{ name: lead.contactName, mobile: lead.contactMobile, isPrimary: true }] : [],
    addresses: input.addresses,
  });
}

export async function convertLead(id: string, input: ConvertInput, actor: AccessTokenPayload) {
  const lead = await LeadModel.findById(id);
  if (!lead) throw new NotFoundError('Lead not found');
  if (lead.stage === 'CONVERTED') throw new ConflictError('Lead has already been converted');

  assertValidTransition('LEAD', lead.stage, 'CONVERTED', actor.role);

  if (input.convertTo === 'SERVICE_REQUEST') {
    // A Lead doesn't carry a structured service/address (it's free-text
    // productInterest/requirement) — first ensure a Customer exists (reusing an
    // already-linked one rather than creating a duplicate), then create the
    // Service Request carrying the lead's requirement/priority forward, per
    // the acceptance criteria in docs/02-product-requirement-document.md §3.2.
    const customer = await convertLeadToCustomer(lead, input);
    if (!customer) throw new NotFoundError('Linked customer not found');
    // Validated as required by leads.validation.ts's superRefine when
    // convertTo === 'SERVICE_REQUEST' — narrowed here for the type checker.
    if (!input.addressSnapshot || !input.serviceId) {
      throw new ConflictError('serviceId and addressSnapshot are required to convert to a service request', 'MISSING_CONVERSION_FIELDS');
    }

    const sr = await createServiceRequest(
      {
        customerId: customer._id.toString(),
        addressSnapshot: input.addressSnapshot,
        serviceId: input.serviceId,
        symptoms: input.symptoms.length > 0 ? input.symptoms : lead.requirement ? [lead.requirement] : [],
        priority: lead.priority,
        source: 'LEAD_CONVERSION',
        relatedLeadId: lead._id.toString(),
      },
      actor.sub
    );

    lead.stage = 'CONVERTED';
    lead.convertedToCustomerId = customer._id as never;
    lead.convertedToServiceRequestId = sr._id as never;
    await lead.save();

    await logActivity({
      entityType: 'LEAD',
      entityId: id,
      user: actor,
      action: 'CONVERTED',
      module: 'leads',
      newValue: { convertedToCustomerId: customer._id, convertedToServiceRequestId: sr._id },
    });

    return { lead, customer, serviceRequest: sr };
  }

  const customer = await convertLeadToCustomer(lead, input);
  if (!customer) throw new NotFoundError('Linked customer not found');

  lead.stage = 'CONVERTED';
  lead.convertedToCustomerId = customer._id as never;
  await lead.save();

  await logActivity({
    entityType: 'LEAD',
    entityId: id,
    user: actor,
    action: 'CONVERTED',
    module: 'leads',
    newValue: { convertedToCustomerId: customer._id },
  });

  return { lead, customer };
}

export async function bulkAssign(leadIds: string[], ownerId: string) {
  const result = await LeadModel.updateMany({ _id: { $in: leadIds } }, { ownerId });
  return { matched: result.matchedCount, modified: result.modifiedCount };
}

// Per docs/07-status-transition-matrix.md §3, "any -> DUPLICATE" is allowed from
// every stage — rather than seed one status_transitions row per possible fromStage,
// this dedicated merge action bypasses the generic engine deliberately (it's a
// distinct, narrowly-scoped operation, not the general changeStage endpoint).
export async function mergeLeads(primaryLeadId: string, duplicateLeadId: string) {
  const [primary, duplicate] = await Promise.all([
    LeadModel.findById(primaryLeadId),
    LeadModel.findById(duplicateLeadId),
  ]);
  if (!primary) throw new NotFoundError('Primary lead not found');
  if (!duplicate) throw new NotFoundError('Duplicate lead not found');

  primary.notes.push(...duplicate.notes);
  primary.attachments.push(...duplicate.attachments);
  await primary.save();

  duplicate.stage = 'DUPLICATE';
  duplicate.duplicateOfLeadId = primary._id as never;
  await duplicate.save();

  return { primary, duplicate };
}
