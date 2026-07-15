import { Schema, model, Document, Types } from 'mongoose';

// docs/14-integration-architecture.md §2, §8 — metadata + audit history for
// every uploaded asset, regardless of which provider actually stored it.
export const FILE_PROVIDERS = ['CLOUDINARY', 'LOCAL'] as const;
export type FileProvider = (typeof FILE_PROVIDERS)[number];

export const FILE_CATEGORIES = [
  'ISSUE_IMAGE',
  'PRODUCT_IMAGE',
  'BEFORE_SERVICE_IMAGE',
  'AFTER_SERVICE_IMAGE',
  'PART_IMAGE',
  'VENDOR_DOCUMENT',
  'EMPLOYEE_DOCUMENT',
  'INVOICE_ATTACHMENT',
  'RECORDING',
  'VIDEO',
  'SIGNATURE',
  'PROFILE_IMAGE',
] as const;
export type FileCategory = (typeof FILE_CATEGORIES)[number];

export interface IFile extends Document {
  category: FileCategory;
  entityType: string;
  entityId: Types.ObjectId;
  provider: FileProvider;
  key: string; // Cloudinary public_id, or local relative path
  url: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: Types.ObjectId;
  deletedAt?: Date;
  createdAt: Date;
}

const fileSchema = new Schema<IFile>(
  {
    category: { type: String, enum: FILE_CATEGORIES, required: true },
    entityType: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    provider: { type: String, enum: FILE_PROVIDERS, required: true },
    key: { type: String, required: true },
    url: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

fileSchema.index({ entityType: 1, entityId: 1 });

export const FileModel = model<IFile>('File', fileSchema);
