import { assertFileAllowed } from './fileStorage';
import { AppError } from './errors';

describe('assertFileAllowed', () => {
  it('allows a jpeg within the size limit for ISSUE_IMAGE', () => {
    expect(() => assertFileAllowed('ISSUE_IMAGE', 'image/jpeg', 5 * 1024 * 1024)).not.toThrow();
  });

  it('rejects a disallowed mime type for a category', () => {
    expect(() => assertFileAllowed('ISSUE_IMAGE', 'application/pdf', 1024)).toThrow(AppError);
    try {
      assertFileAllowed('ISSUE_IMAGE', 'application/pdf', 1024);
    } catch (err) {
      expect((err as AppError).errors[0].code).toBe('FILE_TYPE_NOT_ALLOWED');
    }
  });

  it('rejects a file exceeding the category size limit', () => {
    expect(() => assertFileAllowed('ISSUE_IMAGE', 'image/jpeg', 20 * 1024 * 1024)).toThrow(AppError);
    try {
      assertFileAllowed('ISSUE_IMAGE', 'image/jpeg', 20 * 1024 * 1024);
    } catch (err) {
      expect((err as AppError).errors[0].code).toBe('FILE_TOO_LARGE');
    }
  });

  it('allows a pdf for VENDOR_DOCUMENT within size limit', () => {
    expect(() => assertFileAllowed('VENDOR_DOCUMENT', 'application/pdf', 2 * 1024 * 1024)).not.toThrow();
  });

  it('allows an mp4 within the larger VIDEO size limit', () => {
    expect(() => assertFileAllowed('VIDEO', 'video/mp4', 80 * 1024 * 1024)).not.toThrow();
  });
});
