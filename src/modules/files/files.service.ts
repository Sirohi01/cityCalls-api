import { FileModel, FileCategory } from './files.model';
import { NotFoundError } from '../../lib/errors';
import {
  isCloudinaryEnabled,
  getCloudinarySignedParams,
  saveLocalFile,
  deleteLocalFile,
  deleteCloudinaryFile,
  assertFileAllowed,
} from '../../lib/fileStorage';
import { logActivity } from '../../lib/auditLog';
import { AccessTokenPayload } from '../../lib/jwt';

interface SignedUploadInput {
  category: FileCategory;
  entityType: string;
  entityId: string;
}

// Per docs/10-api-standards.md §9: signed-upload flow when Cloudinary is
// enabled, falls back to a direct-upload endpoint reference otherwise.
export function requestSignedUpload(input: SignedUploadInput) {
  if (isCloudinaryEnabled()) {
    return getCloudinarySignedParams(input.entityType, input.entityId, input.category);
  }
  return { mode: 'LOCAL' as const, uploadUrl: '/api/v1/files/upload' };
}

interface ConfirmUploadInput extends SignedUploadInput {
  publicId: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
}

export async function confirmUpload(input: ConfirmUploadInput, actor: AccessTokenPayload) {
  assertFileAllowed(input.category, input.mimeType, input.sizeBytes);

  const file = await FileModel.create({
    category: input.category,
    entityType: input.entityType,
    entityId: input.entityId,
    provider: 'CLOUDINARY',
    key: input.publicId,
    url: input.url,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    uploadedBy: actor.sub,
  });

  await logActivity({
    entityType: input.entityType,
    entityId: input.entityId,
    user: actor,
    action: 'FILE_UPLOADED',
    module: 'files',
    newValue: { fileId: file._id, category: input.category },
  });

  return file;
}

interface DirectUploadInput extends SignedUploadInput {
  originalName: string;
  mimeType: string;
  buffer: Buffer;
}

export async function uploadLocal(input: DirectUploadInput, actor: AccessTokenPayload) {
  assertFileAllowed(input.category, input.mimeType, input.buffer.length);

  const saved = saveLocalFile(input.entityType, input.entityId, input.category, input.originalName, input.buffer);

  const file = await FileModel.create({
    category: input.category,
    entityType: input.entityType,
    entityId: input.entityId,
    provider: 'LOCAL',
    key: saved.key,
    url: saved.url,
    mimeType: input.mimeType,
    sizeBytes: input.buffer.length,
    uploadedBy: actor.sub,
  });

  await logActivity({
    entityType: input.entityType,
    entityId: input.entityId,
    user: actor,
    action: 'FILE_UPLOADED',
    module: 'files',
    newValue: { fileId: file._id, category: input.category },
  });

  return file;
}

export async function deleteFile(id: string, actor: AccessTokenPayload) {
  const file = await FileModel.findById(id);
  if (!file || file.deletedAt) throw new NotFoundError('File not found');

  if (file.provider === 'CLOUDINARY') {
    await deleteCloudinaryFile(file.key);
  } else {
    deleteLocalFile(file.key);
  }

  file.deletedAt = new Date();
  await file.save();

  await logActivity({
    entityType: file.entityType,
    entityId: file.entityId.toString(),
    user: actor,
    action: 'FILE_DELETED',
    module: 'files',
    oldValue: { fileId: file._id },
  });

  return file;
}

export async function getFile(id: string) {
  const file = await FileModel.findById(id);
  if (!file || file.deletedAt) throw new NotFoundError('File not found');
  return file;
}

interface ListFilesParams {
  entityType: string;
  entityId: string;
  category?: FileCategory;
}

// Powers gallery views (e.g. a Catalog Service's or Brand's attached media) —
// the signed-upload/confirm/delete endpoints above only ever dealt with one
// file at a time, so nothing previously exposed "every file for this entity".
export async function listFiles(params: ListFilesParams) {
  const filter: Record<string, unknown> = {
    entityType: params.entityType,
    entityId: params.entityId,
    deletedAt: { $exists: false },
  };
  if (params.category) filter.category = params.category;
  return FileModel.find(filter).sort({ createdAt: -1 });
}
