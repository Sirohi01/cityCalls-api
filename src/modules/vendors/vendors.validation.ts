import { z } from 'zod';

const vendorContactSchema = z.object({
  name: z.string(),
  mobile: z.string(),
  role: z.string().optional(),
  email: z.string().email().optional(),
  whatsappMarketingConsent: z.enum(['GRANTED', 'REVOKED', 'NOT_ASKED']).default('NOT_ASKED'),
  emailMarketingConsent: z.enum(['GRANTED', 'REVOKED', 'NOT_ASKED']).default('NOT_ASKED'),
});

export const createVendorSchema = z.object({
  companyName: z.string().min(2),
  contactPersons: z
    .array(vendorContactSchema)
    .default([]),
  serviceAreas: z.object({ pinCodes: z.array(z.string()).default([]) }).default({ pinCodes: [] }),
  servicesOffered: z.array(z.string()).default([]),
  brandsHandled: z.array(z.string()).default([]),
  productTypesHandled: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  gst: z.string().optional(),
  pan: z.string().optional(),
  // Previously missing entirely from validation despite being real fields on
  // IVendor/vendorSchema (vendors.model.ts) — silently stripped by validate().
  bankDetails: z
    .object({ accountNumber: z.string(), ifsc: z.string(), accountHolderName: z.string() })
    .optional(),
  agreement: z.object({ url: z.string(), expiryDate: z.coerce.date() }).optional(),
  commissionModel: z.enum(['FIXED', 'SERVICE_WISE']).default('FIXED'),
  commissionRate: z.number().optional(),
  active: z.boolean().optional(),
});

// Explicit (not createVendorSchema.partial()) — see updateCustomerSchema
// in customers.validation.ts for why: .partial() over .default()-bearing
// fields still applies the default on an omitted key, which would reset
// serviceAreas/servicesOffered/skills/etc. to empty on any partial PATCH.
export const updateVendorSchema = z.object({
  companyName: z.string().min(2).optional(),
  contactPersons: z.array(vendorContactSchema).optional(),
  serviceAreas: z.object({ pinCodes: z.array(z.string()).default([]) }).optional(),
  servicesOffered: z.array(z.string()).optional(),
  brandsHandled: z.array(z.string()).optional(),
  productTypesHandled: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
  gst: z.string().optional(),
  pan: z.string().optional(),
  bankDetails: z
    .object({ accountNumber: z.string(), ifsc: z.string(), accountHolderName: z.string() })
    .optional(),
  agreement: z.object({ url: z.string(), expiryDate: z.coerce.date() }).optional(),
  commissionModel: z.enum(['FIXED', 'SERVICE_WISE']).optional(),
  commissionRate: z.number().optional(),
  active: z.boolean().optional(),
});

export const blacklistVendorSchema = z.object({
  blacklisted: z.boolean(),
  blacklistReason: z.string().optional(),
});

export const listVendorsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  pinCode: z.string().optional(),
  active: z.coerce.boolean().optional(),
  blacklisted: z.coerce.boolean().optional(),
  q: z.string().optional(),
});

export const createVendorTechnicianSchema = z.object({
  userId: z.string(),
  vendorId: z.string(),
  skills: z.array(z.string()).default([]),
});
