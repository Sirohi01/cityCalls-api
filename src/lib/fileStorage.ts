import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env';
import { FileCategory } from '../modules/files/files.model';
import { AppError } from './errors';

// File-type/size restrictions per category — docs/14-integration-architecture.md §2.
// Enforced server-side regardless of which adapter (Cloudinary or local) is active.
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_TYPES = ['video/mp4'];
const DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

interface CategoryRule {
  allowedMimeTypes: string[];
  maxSizeBytes: number;
}

const CATEGORY_RULES: Record<FileCategory, CategoryRule> = {
  ISSUE_IMAGE: { allowedMimeTypes: IMAGE_TYPES, maxSizeBytes: 10 * 1024 * 1024 },
  PRODUCT_IMAGE: { allowedMimeTypes: IMAGE_TYPES, maxSizeBytes: 10 * 1024 * 1024 },
  BEFORE_SERVICE_IMAGE: { allowedMimeTypes: IMAGE_TYPES, maxSizeBytes: 10 * 1024 * 1024 },
  AFTER_SERVICE_IMAGE: { allowedMimeTypes: IMAGE_TYPES, maxSizeBytes: 10 * 1024 * 1024 },
  PART_IMAGE: { allowedMimeTypes: IMAGE_TYPES, maxSizeBytes: 10 * 1024 * 1024 },
  VENDOR_DOCUMENT: { allowedMimeTypes: DOCUMENT_TYPES, maxSizeBytes: 10 * 1024 * 1024 },
  EMPLOYEE_DOCUMENT: { allowedMimeTypes: DOCUMENT_TYPES, maxSizeBytes: 10 * 1024 * 1024 },
  INVOICE_ATTACHMENT: { allowedMimeTypes: DOCUMENT_TYPES, maxSizeBytes: 10 * 1024 * 1024 },
  RECORDING: { allowedMimeTypes: ['audio/mpeg', 'audio/mp4', 'audio/wav'], maxSizeBytes: 50 * 1024 * 1024 },
  VIDEO: { allowedMimeTypes: VIDEO_TYPES, maxSizeBytes: 100 * 1024 * 1024 },
  SIGNATURE: { allowedMimeTypes: IMAGE_TYPES, maxSizeBytes: 2 * 1024 * 1024 },
  PROFILE_IMAGE: { allowedMimeTypes: IMAGE_TYPES, maxSizeBytes: 5 * 1024 * 1024 },
};

export function assertFileAllowed(category: FileCategory, mimeType: string, sizeBytes: number): void {
  const rule = CATEGORY_RULES[category];
  if (!rule.allowedMimeTypes.includes(mimeType)) {
    throw new AppError(422, 'File type not allowed for this category', [
      { field: 'file', code: 'FILE_TYPE_NOT_ALLOWED', message: `${mimeType} is not allowed for ${category}` },
    ]);
  }
  if (sizeBytes > rule.maxSizeBytes) {
    throw new AppError(422, 'File exceeds the size limit for this category', [
      { field: 'file', code: 'FILE_TOO_LARGE', message: `File exceeds ${rule.maxSizeBytes} bytes for ${category}` },
    ]);
  }
}

function folderFor(entityType: string, entityId: string, category: FileCategory): string {
  return `${env.nodeEnv}/${entityType}/${entityId}/${category}`;
}

// --- Cloudinary adapter (signed-upload flow per docs/10-api-standards.md §9) ---

export function isCloudinaryEnabled(): boolean {
  return env.cloudinary.enabled && !!env.cloudinary.cloudName && !!env.cloudinary.apiKey && !!env.cloudinary.apiSecret;
}

export interface CloudinarySignedParams {
  mode: 'CLOUDINARY';
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
}

export function getCloudinarySignedParams(entityType: string, entityId: string, category: FileCategory): CloudinarySignedParams {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
  });

  const folder = folderFor(entityType, entityId, category);
  const timestamp = Math.round(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, env.cloudinary.apiSecret as string);

  return {
    mode: 'CLOUDINARY',
    timestamp,
    signature,
    apiKey: env.cloudinary.apiKey as string,
    cloudName: env.cloudinary.cloudName as string,
    folder,
  };
}

// --- Local fallback adapter ---
// No S3-compatible object store is available in this environment, so the local
// fallback is a genuinely working direct-multipart-upload endpoint rather than
// a presigned-PUT-URL flow — see docs/14-integration-architecture.md §2. When
// Cloudinary is enabled this adapter is simply unused.
const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');

export interface LocalUploadResult {
  key: string;
  url: string;
  absolutePath: string;
}

export function saveLocalFile(entityType: string, entityId: string, category: FileCategory, originalName: string, buffer: Buffer): LocalUploadResult {
  const folder = folderFor(entityType, entityId, category);
  const dir = path.join(UPLOAD_ROOT, folder);
  fs.mkdirSync(dir, { recursive: true });

  const safeName = `${crypto.randomUUID()}${path.extname(originalName)}`;
  const absolutePath = path.join(dir, safeName);
  fs.writeFileSync(absolutePath, buffer);

  const key = `${folder}/${safeName}`;
  return { key, url: `/uploads/${key}`, absolutePath };
}

export function deleteLocalFile(key: string): void {
  const absolutePath = path.join(UPLOAD_ROOT, key);
  if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
}

export async function deleteCloudinaryFile(publicId: string): Promise<void> {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
  });
  await cloudinary.uploader.destroy(publicId);
}
