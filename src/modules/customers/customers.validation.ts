import { z } from 'zod';

const addressSchema = z.object({
  label: z.string().optional(),
  line1: z.string().optional(),
  line2: z.string().optional(),
  landmark: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  pinCode: z.string().min(4),
  country: z.string().default('India'),
  isDefault: z.boolean().default(false),
});

const contactSchema = z.object({
  name: z.string().optional(),
  mobile: z.string().min(10),
  isPrimary: z.boolean().default(false),
});

const CONSENT_STATE_VALUES = ['GRANTED', 'REVOKED', 'NOT_ASKED'] as const;
const consentInputSchema = z.object({
  whatsapp: z.enum(CONSENT_STATE_VALUES).optional(),
  email: z.enum(CONSENT_STATE_VALUES).optional(),
  sms: z.enum(CONSENT_STATE_VALUES).optional(),
});

export const createCustomerSchema = z.object({
  // Master-driven (masterType CUSTOMER_TYPE) — validated against real key
  // values by the Masters admin screen, not a fixed enum here.
  customerType: z.string().min(1).default('RESIDENTIAL'),
  name: z.string().min(2),
  businessName: z.string().optional(),
  gstin: z.string().optional(),
  email: z.string().email().optional(),
  contacts: z.array(contactSchema).min(1, 'At least one contact is required'),
  addresses: z.array(addressSchema).default([]),
  tags: z.array(z.string()).default([]),
  consent: consentInputSchema.optional(),
  notes: z.array(z.string()).optional(),
});

// NOT createCustomerSchema.partial() — in this Zod version, .partial()
// wraps .default()-bearing fields in .optional() but the default still
// fires for an omitted key, so a partial() derivation would silently
// reset addresses/tags/customerType to their create-time defaults on
// every PATCH that doesn't explicitly resend them (e.g. wiping a
// customer's whole address book when only their email is edited).
// Defined explicitly with plain .optional() (no .default()) instead, so
// an omitted field is left untouched rather than reset.
export const updateCustomerSchema = z.object({
  customerType: z.string().min(1).optional(),
  name: z.string().min(2).optional(),
  businessName: z.string().optional(),
  gstin: z.string().optional(),
  email: z.string().email().optional(),
  contacts: z.array(contactSchema).optional(),
  addresses: z.array(addressSchema).optional(),
  tags: z.array(z.string()).optional(),
  consent: consentInputSchema.optional(),
  notes: z.array(z.string()).optional(),
});

export const addAddressSchema = addressSchema;
export const updateAddressSchema = addressSchema.partial();

export const addProductSchema = z.object({
  brandId: z.string(),
  productTypeId: z.string(),
  modelNumber: z.string().optional(),
  serialNumber: z.string().optional(),
  purchaseDate: z.coerce.date().optional(),
});

export const updateConsentSchema = z.object({
  channel: z.enum(['whatsapp', 'email', 'sms']),
  state: z.enum(['GRANTED', 'REVOKED', 'NOT_ASKED']),
  reason: z.string().optional(),
});

export const fcmTokenSchema = z.object({
  token: z.string().min(1),
});

export const listCustomersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  customerType: z.string().optional(),
  blacklisted: z.coerce.boolean().optional(),
  tag: z.string().optional(),
  q: z.string().optional(),
  vertical: z.string().optional(),
});
