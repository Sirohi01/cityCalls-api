import { z } from 'zod';

const addressSchema = z.object({
  label: z.string().optional(),
  line1: z.string().min(1),
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
  // A full address isn't always known at creation time (e.g. the call-intake
  // waitlist path only has a pincode, not a street address) — notes lets
  // that context be recorded without inventing a fake address.line1.
  notes: z.array(z.string()).optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

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

export const listCustomersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  customerType: z.string().optional(),
  blacklisted: z.coerce.boolean().optional(),
  tag: z.string().optional(),
  q: z.string().optional(),
});
