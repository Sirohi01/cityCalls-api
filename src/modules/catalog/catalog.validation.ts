import { z } from 'zod';

export const createServiceSchema = z.object({
  name: z.string().min(2),
  categoryId: z.string(),
  subCategoryId: z.string().optional(),
  applicableBrandIds: z.array(z.string()).default([]),
  applicableProductTypeIds: z.array(z.string()).default([]),
  symptomIds: z.array(z.string()).default([]),
  defectIds: z.array(z.string()).default([]),
  solutionTypeIds: z.array(z.string()).default([]),
  requiredSkills: z.array(z.string()).default([]),
  expectedDurationMinutes: z.number().default(60),
  pricing: z
    .object({
      basePrice: z.number().default(0),
      visitingCharge: z.number().default(0),
      inspectionCharge: z.number().default(0),
      emergencyCharge: z.number().default(0),
    })
    .default({ basePrice: 0, visitingCharge: 0, inspectionCharge: 0, emergencyCharge: 0 }),
  taxRateId: z.string().optional(),
  warrantyPeriodDays: z.number().default(0),
  reopenPeriodDaysOverride: z.number().optional(),
  requiredDocuments: z.array(z.string()).default([]),
  requiredImages: z.object({ before: z.number().default(0), after: z.number().default(0) }).default({ before: 0, after: 0 }),
  mandatoryChecklist: z.array(z.string()).default([]),
  slaMinutes: z.number().default(1440),
  active: z.boolean().optional(),
});

export const updateServiceSchema = z.object({
  name: z.string().min(2).optional(),
  categoryId: z.string().optional(),
  subCategoryId: z.string().optional(),
  applicableBrandIds: z.array(z.string()).optional(),
  applicableProductTypeIds: z.array(z.string()).optional(),
  symptomIds: z.array(z.string()).optional(),
  defectIds: z.array(z.string()).optional(),
  solutionTypeIds: z.array(z.string()).optional(),
  requiredSkills: z.array(z.string()).optional(),
  expectedDurationMinutes: z.number().optional(),
  pricing: z
    .object({
      basePrice: z.number().default(0),
      visitingCharge: z.number().default(0),
      inspectionCharge: z.number().default(0),
      emergencyCharge: z.number().default(0),
    })
    .optional(),
  taxRateId: z.string().optional(),
  warrantyPeriodDays: z.number().optional(),
  reopenPeriodDaysOverride: z.number().optional(),
  requiredDocuments: z.array(z.string()).optional(),
  requiredImages: z.object({ before: z.number().default(0), after: z.number().default(0) }).optional(),
  mandatoryChecklist: z.array(z.string()).optional(),
  slaMinutes: z.number().optional(),
  active: z.boolean().optional(),
});

export const listServicesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  active: z.coerce.boolean().optional(),
  categoryId: z.string().optional(),
  productTypeId: z.string().optional(),
  pinCode: z.string().optional(),
  q: z.string().optional(),
  vertical: z.string().optional(),
});
