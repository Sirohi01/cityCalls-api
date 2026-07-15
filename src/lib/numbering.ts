import { NumberingSeriesModel, DocumentType } from '../modules/config/numberingSeries.model';
import { BranchModel } from '../modules/organization/organization.model';

// Default numbering prefixes per docs/coordination/06-naming-conventions.md §3.
const DEFAULT_PREFIX: Record<DocumentType, string> = {
  SERVICE_REQUEST: 'SR',
  LEAD: 'LD',
  CALL: 'CL',
  ESTIMATE: 'EST',
  PROFORMA_INVOICE: 'PI',
  INVOICE: 'INV',
  PAYMENT_RECEIPT: 'RC',
  CREDIT_NOTE: 'CN',
  DEBIT_NOTE: 'DN',
  CUSTOMER: 'CU',
  VENDOR: 'VN',
  VENDOR_INVOICE: 'VI',
  VENDOR_PAYOUT: 'VP',
};

// Branch/FY-scoped document types vs. org-wide ones (Customer, Vendor).
const BRANCH_AND_FY_SCOPED: DocumentType[] = [
  'SERVICE_REQUEST',
  'LEAD',
  'CALL',
  'ESTIMATE',
  'PROFORMA_INVOICE',
  'INVOICE',
  'PAYMENT_RECEIPT',
  'CREDIT_NOTE',
  'DEBIT_NOTE',
  'VENDOR_INVOICE',
  'VENDOR_PAYOUT',
];

// India financial year (Apr-Mar) formatted as "2526" for FY2025-26.
// Default assumption per docs/21-open-decisions-and-clarifications.md — confirm if different.
export function currentFinancialYear(date: Date = new Date()): string {
  const month = date.getMonth() + 1; // 1-12
  const startYear = month >= 4 ? date.getFullYear() : date.getFullYear() - 1;
  const endYearShort = (startYear + 1) % 100;
  return `${startYear.toString().slice(-2)}${endYearShort.toString().padStart(2, '0')}`;
}

async function resolveBranchCode(branchId?: string): Promise<string | undefined> {
  if (!branchId) return undefined;
  const branch = await BranchModel.findById(branchId).select('code').lean();
  return branch?.code;
}

// Atomically increments and returns the next formatted document number.
export async function getNextNumber(documentType: DocumentType, branchId?: string): Promise<string> {
  const isScoped = BRANCH_AND_FY_SCOPED.includes(documentType);
  const financialYear = isScoped ? currentFinancialYear() : undefined;

  const series = await NumberingSeriesModel.findOneAndUpdate(
    { documentType, branchId: isScoped ? branchId : undefined, financialYear },
    {
      $inc: { lastSequence: 1 },
      $setOnInsert: { prefix: DEFAULT_PREFIX[documentType], padLength: 6 },
    },
    { new: true, upsert: true }
  );

  const seq = series.lastSequence.toString().padStart(series.padLength, '0');
  const branchCode = isScoped ? await resolveBranchCode(branchId) : undefined;

  const parts = [series.prefix, branchCode, financialYear, seq].filter(Boolean);
  return parts.join('-');
}
