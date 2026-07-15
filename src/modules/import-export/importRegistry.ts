import { ZodType } from 'zod';
import { createCustomerSchema } from '../customers/customers.validation';
import { createLeadSchema } from '../leads/leads.validation';
import { createCustomer } from '../customers/customers.service';
import { createLead } from '../leads/leads.service';

export interface ImportEntityDef {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: ZodType<any>;
  // Spreadsheet rows are always flat {header: cellValue} objects — this maps
  // one row into the shape the entity's create Zod schema expects, including
  // building any nested structures (Customer.contacts/addresses) the flat
  // template columns represent per docs/15-excel-import-export-specification.md §3.
  transformRow: (row: Record<string, string>) => Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  create: (data: any) => Promise<unknown>;
  permissionModule: string;
}

function optional(value: string | undefined): string | undefined {
  return value && value.trim() !== '' ? value.trim() : undefined;
}

// docs/15-excel-import-export-specification.md §3 names customers,
// customer_products, calls, service_requests, leads, and vendors as the
// initial template set. Only customers and leads are wired for import here
// — the cleanest, most self-contained "create a new record" cases. The
// other four (customer_products needs an existing customer resolved by
// natural key; calls/service_requests carry too much operational state for
// a bulk-create to be safe; vendors has its own onboarding flow) are a
// documented gap, extensible via this same registry, not a silent omission.
export const IMPORT_REGISTRY: Record<string, ImportEntityDef> = {
  customers: {
    schema: createCustomerSchema,
    transformRow: (row) => ({
      customerType: optional(row.customerType) ?? 'INDIVIDUAL',
      name: row.name,
      businessName: optional(row.businessName),
      gstin: optional(row.gstin),
      email: optional(row.email),
      contacts: [{ name: optional(row.contactName) ?? row.name, mobile: row.mobile, isPrimary: true }],
      addresses:
        optional(row.addressLine1) && optional(row.city) && optional(row.state) && optional(row.pinCode)
          ? [
              {
                line1: row.addressLine1,
                line2: optional(row.addressLine2),
                landmark: optional(row.landmark),
                city: row.city,
                state: row.state,
                pinCode: row.pinCode,
                country: optional(row.country) ?? 'India',
                isDefault: true,
              },
            ]
          : [],
      tags: optional(row.tags) ? row.tags.split(';').map((t) => t.trim()).filter(Boolean) : [],
    }),
    // createCustomer returns { customer, potentialDuplicates }, not the
    // document directly (it surfaces duplicate-detection alongside the
    // create) — unwrap it so import.service.ts's generic `created._id` read
    // works the same way it does for createLead's direct-document return.
    create: async (data) => (await createCustomer(data)).customer,
    permissionModule: 'customers',
  },
  leads: {
    schema: createLeadSchema,
    transformRow: (row) => ({
      source: row.source,
      priority: optional(row.priority) ?? 'NORMAL',
      ownerId: row.ownerId,
      customerId: optional(row.customerId),
      contactName: optional(row.contactName),
      contactMobile: optional(row.contactMobile),
      productInterest: optional(row.productInterest),
      requirement: optional(row.requirement),
      followUpDate: optional(row.followUpDate),
      branchId: optional(row.branchId),
      campaignId: optional(row.campaignId),
    }),
    create: createLead,
    permissionModule: 'leads',
  },
};

export type ImportEntity = keyof typeof IMPORT_REGISTRY;
