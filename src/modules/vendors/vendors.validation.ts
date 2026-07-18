import { z } from 'zod';

export const createVendorSchema = z.object({
  companyName: z.string().min(2),
  contactPersons: z
    .array(z.object({ name: z.string(), mobile: z.string(), role: z.string().optional() }))
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

export const updateVendorSchema = createVendorSchema.partial();

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
