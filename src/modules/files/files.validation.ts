import { z } from 'zod';
import { FILE_CATEGORIES } from './files.model';

export const signedUploadSchema = z.object({
  category: z.enum(FILE_CATEGORIES),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
});

export const confirmUploadSchema = z.object({
  category: z.enum(FILE_CATEGORIES),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  publicId: z.string().min(1),
  url: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().positive(),
});

export const uploadFormSchema = z.object({
  category: z.enum(FILE_CATEGORIES),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
});

export const listFilesQuerySchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  category: z.enum(FILE_CATEGORIES).optional(),
});
