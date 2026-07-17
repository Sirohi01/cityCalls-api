import { CustomerModel } from '../customers/customers.model';
import { ServiceRequestModel } from '../service-requests/serviceRequests.model';
import { LeadModel } from '../leads/leads.model';
import { CallModel } from '../calls/calls.model';

const RESULTS_PER_ENTITY = 5;

export interface SearchResult {
  entityType: 'CUSTOMER' | 'SERVICE_REQUEST' | 'LEAD' | 'CALL';
  id: string;
  title: string;
  subtitle?: string;
}

// docs/manish/10-admin-functional-integration-plan.md §4: a lightweight
// cross-entity search for the admin shell's search bar — Customers, Service
// Requests, Leads, Calls by their key identifying fields, a small ranked
// result set rather than a full-text search engine. Case-insensitive regex
// match (consistent with the `q` param pattern already used by each
// entity's own list endpoint) rather than $text, since it needs to match
// partial numbers/mobiles, not just whole-word text.
export async function globalSearch(q: string): Promise<SearchResult[]> {
  const pattern = { $regex: q, $options: 'i' };

  const [customers, serviceRequests, leads, calls] = await Promise.all([
    CustomerModel.find({ $or: [{ name: pattern }, { 'contacts.mobile': pattern }] })
      .limit(RESULTS_PER_ENTITY)
      .select('name contacts')
      .lean(),
    ServiceRequestModel.find({ number: pattern }).limit(RESULTS_PER_ENTITY).select('number status').lean(),
    LeadModel.find({ $or: [{ number: pattern }, { contactName: pattern }, { contactMobile: pattern }] })
      .limit(RESULTS_PER_ENTITY)
      .select('number contactName stage')
      .lean(),
    CallModel.find({ $or: [{ number: pattern }, { callerNumber: pattern }, { customerName: pattern }] })
      .limit(RESULTS_PER_ENTITY)
      .select('number customerName callType')
      .lean(),
  ]);

  const results: SearchResult[] = [
    ...customers.map((c) => ({
      entityType: 'CUSTOMER' as const,
      id: c._id.toString(),
      title: c.name,
      subtitle: c.contacts.find((ct) => ct.isPrimary)?.mobile ?? c.contacts[0]?.mobile,
    })),
    ...serviceRequests.map((sr) => ({
      entityType: 'SERVICE_REQUEST' as const,
      id: sr._id.toString(),
      title: sr.number,
      subtitle: sr.status,
    })),
    ...leads.map((l) => ({
      entityType: 'LEAD' as const,
      id: l._id.toString(),
      title: l.number,
      subtitle: l.contactName ?? l.stage,
    })),
    ...calls.map((c) => ({
      entityType: 'CALL' as const,
      id: c._id.toString(),
      title: c.number,
      subtitle: c.customerName ?? c.callType,
    })),
  ];

  return results;
}
