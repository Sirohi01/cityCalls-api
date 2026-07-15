import { PaymentReceiptModel, PaymentMethod } from './paymentReceipts.model';
import { InvoiceModel } from './invoices.model';
import { NotFoundError, ConflictError } from '../../lib/errors';
import { getNextNumber, currentFinancialYear } from '../../lib/numbering';
import { generateDocumentPdf } from '../../lib/pdfGenerator';
import { trigger } from '../../lib/notifications';
import { logActivity } from '../../lib/auditLog';
import { AccessTokenPayload } from '../../lib/jwt';
import { updateStatus as updateServiceRequestStatus } from '../service-requests/serviceRequests.service';

interface RecordPaymentInput {
  amount: number;
  method: PaymentMethod;
  reference?: string;
  proofUrl?: string;
}

// Per docs/16-pdf-and-financial-documents.md §7: an Invoice's status
// (PARTIALLY_PAID/PAID) is derived from the sum of its linked receipts, never
// set directly — this is the one function that writes both, atomically from
// the caller's perspective, so the two can never drift apart.
export async function recordPayment(invoiceId: string, input: RecordPaymentInput, actor: AccessTokenPayload) {
  const invoice = await InvoiceModel.findById(invoiceId);
  if (!invoice) throw new NotFoundError('Invoice not found');
  if (invoice.status === 'CANCELLED') {
    throw new ConflictError('Cannot record a payment against a cancelled invoice', 'INVOICE_CANCELLED');
  }

  const number = await getNextNumber('PAYMENT_RECEIPT', invoice.branchId.toString());
  const receipt = await PaymentReceiptModel.create({
    number,
    invoiceId,
    customerId: invoice.customerId,
    branchId: invoice.branchId,
    financialYear: currentFinancialYear(),
    amount: input.amount,
    method: input.method,
    reference: input.reference,
    proofUrl: input.proofUrl,
    collectedBy: actor.sub,
  });
  receipt.pdfUrl = await generateDocumentPdf('PAYMENT_RECEIPT', receipt._id.toString());
  await receipt.save();

  invoice.amountPaid += input.amount;
  // Overpayment (rounding, etc.) is capped for status purposes — the excess is
  // a customer-credit concern (docs §7), not modeled further here.
  invoice.status = invoice.amountPaid >= invoice.total ? 'PAID' : 'PARTIALLY_PAID';
  await invoice.save();

  await logActivity({
    entityType: 'INVOICE',
    entityId: invoiceId,
    user: actor,
    action: 'PAYMENT_RECORDED',
    module: 'finance',
    newValue: { receiptId: receipt._id, amount: input.amount, newStatus: invoice.status },
  });

  await trigger('PAYMENT_RECEIVED', {
    recipient: { customerId: invoice.customerId.toString() },
    variables: { invoiceId, receiptNumber: number, amount: input.amount },
  });

  // If the linked Service Request is waiting on payment, advance it — this is
  // the one place finance and the status engine touch, matching docs/06
  // Stage 9's "PAYMENT_PENDING -> PARTIALLY_PAID/PAID" transition.
  if (invoice.serviceRequestId) {
    try {
      await updateServiceRequestStatus(invoice.serviceRequestId.toString(), invoice.status, actor, {
        reason: `Payment recorded via receipt ${number}`,
      });
    } catch {
      // The linked Service Request may already be in a status where this specific
      // transition isn't valid (e.g. already manually advanced) — payment recording
      // itself must still succeed regardless, per docs/16 §7's payment-first framing.
    }
  }

  return receipt;
}

export async function listPaymentsForInvoice(invoiceId: string) {
  return PaymentReceiptModel.find({ invoiceId }).sort({ createdAt: -1 });
}

export async function getPaymentReceipt(id: string) {
  const receipt = await PaymentReceiptModel.findById(id);
  if (!receipt) throw new NotFoundError('Payment receipt not found');
  return receipt;
}
