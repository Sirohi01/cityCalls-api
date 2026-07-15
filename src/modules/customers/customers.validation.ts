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

export const createCustomerSchema = z.object({
  customerType: z.enum(['INDIVIDUAL', 'BUSINESS']).default('INDIVIDUAL'),
  name: z.string().min(2),
  businessName: z.string().optional(),
  gstin: z.string().optional(),
  contacts: z.array(contactSchema).min(1, 'At least one contact is required'),
  addresses: z.array(addressSchema).default([]),
  tags: z.array(z.string()).default([]),
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
  customerType: z.enum(['INDIVIDUAL', 'BUSINESS']).optional(),
  blacklisted: z.coerce.boolean().optional(),
  q: z.string().optional(),
});
