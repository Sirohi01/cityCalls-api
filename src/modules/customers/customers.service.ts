import { CustomerModel, CustomerProductModel, ConsentState } from './customers.model';
import { ServiceRequestModel } from '../service-requests/serviceRequests.model';
import { UserModel } from '../users/users.model';
import { NotFoundError } from '../../lib/errors';
import { buildPaginationMeta } from '../../lib/apiResponse';
import { logActivity } from '../../lib/auditLog';
import { AccessTokenPayload } from '../../lib/jwt';
import { resolveVerticalServiceIds } from '../../lib/verticals';

interface ListParams {
  page: number;
  limit: number;
  customerType?: 'INDIVIDUAL' | 'BUSINESS';
  blacklisted?: boolean;
  tag?: string;
  q?: string;
  vertical?: string;
}

export async function listCustomers(params: ListParams) {
  const filter: Record<string, unknown> = {};
  if (params.customerType) filter.customerType = params.customerType;
  if (params.blacklisted !== undefined) filter.blacklisted = params.blacklisted;
  if (params.tag) filter.tags = params.tag;
  // A customer has no direct category link — "Beauty customer" means they
  // have at least one Service Request for a service in that vertical.
  if (params.vertical) {
    const serviceIds = await resolveVerticalServiceIds(params.vertical);
    const customerIds = await ServiceRequestModel.find({ serviceId: { $in: serviceIds } }).distinct('customerId');
    filter._id = { $in: customerIds };
  }
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
export async function findOrCreateOwnCustomer(userId: string) {
  let customer = await CustomerModel.findOne({ userId });
  if (customer) return customer;

  const user = await UserModel.findById(userId);
  if (!user) throw new NotFoundError('User not found');

  customer = await CustomerModel.findOne({ 'contacts.mobile': user.mobile });
  if (customer) {
    if (!customer.userId) {
      customer.userId = user._id;
      await customer.save();
    }
    return customer;
  }

  return CustomerModel.create({
    userId: user._id,
    name: user.name,
    contacts: [{ name: user.name, mobile: user.mobile, isPrimary: true }],
  });
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

// Duplicate detection is surfaced automatically as a non-blocking warning on
// create, per the acceptance criteria in docs/02-product-requirement-document.md —
// staff sees potential matches but is never prevented from creating a genuinely
// new customer (false positives are more costly than a missed duplicate).
export async function createCustomer(data: {
  name: string;
  businessName?: string;
  gstin?: string;
  contacts: { name?: string; mobile: string; isPrimary: boolean }[];
  [key: string]: unknown;
}) {
  const primaryMobile = data.contacts.find((c) => c.isPrimary)?.mobile ?? data.contacts[0]?.mobile;
  const potentialDuplicates = await findDuplicates({
    mobile: primaryMobile,
    gstin: data.gstin,
    businessName: data.businessName,
    name: data.name,
  });

  const customer = await CustomerModel.create(data);
  return { customer, potentialDuplicates };
}

export async function updateCustomer(id: string, data: Record<string, unknown>) {
  const customer = await CustomerModel.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  if (!customer) throw new NotFoundError('Customer not found');
  return customer;
}

export async function deleteCustomer(id: string) {
  const customer = await CustomerModel.findByIdAndDelete(id);
  if (!customer) throw new NotFoundError('Customer not found');
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

export async function updateAddress(customerId: string, addressId: string, data: Record<string, unknown>) {
  const customer = await CustomerModel.findById(customerId);
  if (!customer) throw new NotFoundError('Customer not found');

  const address = customer.addresses.id(addressId);
  if (!address) throw new NotFoundError('Address not found');

  Object.assign(address, data);
  await customer.save();
  return customer;
}

export async function deleteAddress(customerId: string, addressId: string) {
  const customer = await CustomerModel.findById(customerId);
  if (!customer) throw new NotFoundError('Customer not found');

  const address = customer.addresses.id(addressId);
  if (!address) throw new NotFoundError('Address not found');

  address.deleteOne();
  await customer.save();
  return customer;
}

// Aggregates a customer's activity across modules for the detail-page timeline.
// Calls/Leads/Service Requests/Invoices don't exist yet (Phases 3-6), so those
// sections return empty for now — the endpoint shape is final, the data fills in
// as each dependent module lands, per docs/manish/07-api-development-sequence.md.
export async function getCustomerHistory(id: string) {
  const customer = await CustomerModel.findById(id);
  if (!customer) throw new NotFoundError('Customer not found');

  const products = await CustomerProductModel.find({ customerId: id });

  return {
    customerId: id,
    products,
    calls: [], // Phase 3
    leads: [], // Phase 3
    serviceRequests: [], // Phase 4
    invoices: [], // Phase 6
    payments: [], // Phase 6
    feedback: [], // Phase 7
  };
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
