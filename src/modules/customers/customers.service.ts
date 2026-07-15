import { CustomerModel, CustomerProductModel, ConsentState } from './customers.model';
import { NotFoundError } from '../../lib/errors';
import { buildPaginationMeta } from '../../lib/apiResponse';
import { logActivity } from '../../lib/auditLog';
import { AccessTokenPayload } from '../../lib/jwt';

interface ListParams {
  page: number;
  limit: number;
  customerType?: 'INDIVIDUAL' | 'BUSINESS';
  blacklisted?: boolean;
  q?: string;
}

export async function listCustomers(params: ListParams) {
  const filter: Record<string, unknown> = {};
  if (params.customerType) filter.customerType = params.customerType;
  if (params.blacklisted !== undefined) filter.blacklisted = params.blacklisted;
  if (params.q) {
    filter.$or = [
      { name: { $regex: params.q, $options: 'i' } },
      { 'contacts.mobile': { $regex: params.q, $options: 'i' } },
    ];
  }

  const skip = (params.page - 1) * params.limit;
  const [items, total] = await Promise.all([
    CustomerModel.find(filter).skip(skip).limit(params.limit).sort({ createdAt: -1 }),
    CustomerModel.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta(params.page, params.limit, total) };
}

export async function getCustomer(id: string) {
  const customer = await CustomerModel.findById(id);
  if (!customer) throw new NotFoundError('Customer not found');
  return customer;
}

// Duplicate detection per docs/04-modules-and-feature-list.md M5 — matches on mobile
// (authoritative), or name/GSTIN/business-name similarity (suggestion only, never auto-merge).
export async function findDuplicates(data: {
  mobile?: string;
  gstin?: string;
  businessName?: string;
  name?: string;
}) {
  const or: Record<string, unknown>[] = [];
  if (data.mobile) or.push({ 'contacts.mobile': data.mobile });
  if (data.gstin) or.push({ gstin: data.gstin });
  if (data.businessName) or.push({ businessName: { $regex: `^${escapeRegex(data.businessName)}$`, $options: 'i' } });
  if (data.name) or.push({ name: { $regex: `^${escapeRegex(data.name)}$`, $options: 'i' } });

  if (or.length === 0) return [];
  return CustomerModel.find({ $or: or }).limit(10);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function createCustomer(data: Record<string, unknown>) {
  return CustomerModel.create(data);
}

export async function updateCustomer(id: string, data: Record<string, unknown>) {
  const customer = await CustomerModel.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  if (!customer) throw new NotFoundError('Customer not found');
  return customer;
}

export async function addAddress(id: string, address: Record<string, unknown>) {
  const customer = await CustomerModel.findByIdAndUpdate(
    id,
    { $push: { addresses: address } },
    { new: true, runValidators: true }
  );
  if (!customer) throw new NotFoundError('Customer not found');
  return customer;
}

export async function addProduct(customerId: string, data: Record<string, unknown>) {
  const customer = await CustomerModel.findById(customerId);
  if (!customer) throw new NotFoundError('Customer not found');
  return CustomerProductModel.create({ ...data, customerId });
}

export async function listProducts(customerId: string) {
  return CustomerProductModel.find({ customerId }).populate('brandId productTypeId');
}

// Per docs/17-security-and-audit.md §8: consent changes are audit-logged
// (who, when, from-what, to-what), not just a boolean flip.
export async function updateConsent(
  id: string,
  channel: 'whatsapp' | 'email' | 'sms',
  state: ConsentState,
  reason: string | undefined,
  actor: AccessTokenPayload
) {
  const customer = await CustomerModel.findById(id);
  if (!customer) throw new NotFoundError('Customer not found');

  const oldValue = customer.consent[channel];
  customer.consent[channel] = state;
  await customer.save();

  await logActivity({
    entityType: 'CONSENT',
    entityId: id,
    user: actor,
    action: 'CONSENT_CHANGED',
    module: 'customers',
    oldValue: { channel, state: oldValue },
    newValue: { channel, state },
    reason,
  });

  return customer;
}
