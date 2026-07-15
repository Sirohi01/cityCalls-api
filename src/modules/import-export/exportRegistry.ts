import { Model, Types } from 'mongoose';
import { CustomerModel } from '../customers/customers.model';
import { LeadModel } from '../leads/leads.model';
import { ServiceRequestModel } from '../service-requests/serviceRequests.model';
import { CallModel } from '../calls/calls.model';
import { InvoiceModel } from '../finance/invoices.model';
import { DataScope } from '../users/users.types';
import { AccessTokenPayload } from '../../lib/jwt';

export interface ExportEntityDef {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: Model<any>;
  defaultColumns: string[];
  // Restricted to BRANCH/ALL — the only two scopes granted the 'export'
  // action in the RBAC seed (see scripts/seed.ts), so every entity here only
  // needs to know how to pin itself to a single branch, never OWN/TEAM/VENDOR.
  buildFilter: (scope: DataScope, user: AccessTokenPayload, query: Record<string, string | undefined>) => Record<string, unknown>;
  // The RBAC module name this entity's export/import permission is checked
  // against — e.g. invoices are exported under the 'finance' module
  // permission, matching where finance CRUD permissions already live.
  permissionModule: string;
}

function branchScopedFilter(user: AccessTokenPayload, scope: DataScope): Record<string, unknown> {
  if (scope === 'BRANCH' && user.branchId) {
    return { branchId: new Types.ObjectId(user.branchId) };
  }
  return {};
}

// docs/15-excel-import-export-specification.md §3 names customers,
// customer_products, calls, service_requests, leads, and vendors as the
// initial template set. customer_products and vendors are not wired into
// this registry yet — documented gap, extensible the same way the other
// five entities were added, not a silent omission.
export const EXPORT_REGISTRY: Record<string, ExportEntityDef> = {
  customers: {
    model: CustomerModel,
    defaultColumns: ['_id', 'customerType', 'name', 'businessName', 'email', 'gstin', 'contacts', 'addresses', 'tags', 'blacklisted', 'createdAt'],
    // Customer has no branchId field in this schema — never branch-scoped, matches customers.service.ts's existing list query.
    buildFilter: () => ({}),
    permissionModule: 'customers',
  },
  leads: {
    model: LeadModel,
    defaultColumns: ['_id', 'number', 'stage', 'source', 'priority', 'score', 'ownerId', 'contactName', 'contactMobile', 'branchId', 'createdAt'],
    buildFilter: (scope, user) => branchScopedFilter(user, scope),
    permissionModule: 'leads',
  },
  serviceRequests: {
    model: ServiceRequestModel,
    defaultColumns: ['_id', 'number', 'status', 'priority', 'customerId', 'serviceId', 'branchId', 'assigneeType', 'assigneeId', 'isEscalated', 'createdAt', 'completedAt'],
    buildFilter: (scope, user) => branchScopedFilter(user, scope),
    permissionModule: 'serviceRequests',
  },
  calls: {
    model: CallModel,
    defaultColumns: ['_id', 'number', 'callType', 'direction', 'customerId', 'callerNumber', 'callDate', 'priority', 'outcome', 'branchId', 'createdAt'],
    buildFilter: (scope, user) => branchScopedFilter(user, scope),
    permissionModule: 'calls',
  },
  invoices: {
    model: InvoiceModel,
    defaultColumns: ['_id', 'number', 'customerId', 'branchId', 'status', 'subtotal', 'total', 'amountPaid', 'createdAt'],
    buildFilter: (scope, user) => branchScopedFilter(user, scope),
    permissionModule: 'finance',
  },
};

export type ExportEntity = keyof typeof EXPORT_REGISTRY;
