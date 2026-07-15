import { CreditNoteModel, DebitNoteModel } from './creditDebitNotes.model';
import { InvoiceModel } from './invoices.model';
import { NotFoundError } from '../../lib/errors';
import { getNextNumber, currentFinancialYear } from '../../lib/numbering';
import { generateDocumentPdf } from '../../lib/pdfGenerator';
import { logActivity } from '../../lib/auditLog';
import { AccessTokenPayload } from '../../lib/jwt';

interface NoteInput {
  invoiceId: string;
  amount: number;
  reason: string;
}

// Post-payment invoice corrections — docs/16-pdf-and-financial-documents.md §4.
// The original Invoice is never edited in place; these are the only two ways
// to adjust its effective value once payment exists.
export async function issueCreditNote(input: NoteInput, actor: AccessTokenPayload) {
  const invoice = await InvoiceModel.findById(input.invoiceId);
  if (!invoice) throw new NotFoundError('Invoice not found');

  const number = await getNextNumber('CREDIT_NOTE', invoice.branchId.toString());
  const note = await CreditNoteModel.create({
    number,
    invoiceId: input.invoiceId,
    customerId: invoice.customerId,
    branchId: invoice.branchId,
    financialYear: currentFinancialYear(),
    amount: input.amount,
    reason: input.reason,
    createdBy: actor.sub,
  });
  note.pdfUrl = await generateDocumentPdf('CREDIT_NOTE', note._id.toString());
  await note.save();

  await logActivity({
    entityType: 'INVOICE',
    entityId: input.invoiceId,
    user: actor,
    action: 'CREDIT_NOTE_ISSUED',
    module: 'finance',
    newValue: { creditNoteId: note._id, amount: input.amount },
    reason: input.reason,
  });

  return note;
}

export async function issueDebitNote(input: NoteInput, actor: AccessTokenPayload) {
  const invoice = await InvoiceModel.findById(input.invoiceId);
  if (!invoice) throw new NotFoundError('Invoice not found');

  const number = await getNextNumber('DEBIT_NOTE', invoice.branchId.toString());
  const note = await DebitNoteModel.create({
    number,
    invoiceId: input.invoiceId,
    customerId: invoice.customerId,
    branchId: invoice.branchId,
    financialYear: currentFinancialYear(),
    amount: input.amount,
    reason: input.reason,
    createdBy: actor.sub,
  });
  note.pdfUrl = await generateDocumentPdf('DEBIT_NOTE', note._id.toString());
  await note.save();

  await logActivity({
    entityType: 'INVOICE',
    entityId: input.invoiceId,
    user: actor,
    action: 'DEBIT_NOTE_ISSUED',
    module: 'finance',
    newValue: { debitNoteId: note._id, amount: input.amount },
    reason: input.reason,
  });

  return note;
}

export async function listNotesForInvoice(invoiceId: string) {
  const [creditNotes, debitNotes] = await Promise.all([
    CreditNoteModel.find({ invoiceId }).sort({ createdAt: -1 }),
    DebitNoteModel.find({ invoiceId }).sort({ createdAt: -1 }),
  ]);
  return { creditNotes, debitNotes };
}
