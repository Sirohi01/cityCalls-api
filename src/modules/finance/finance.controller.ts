import { Response, NextFunction } from 'express';
import * as estimatesService from './estimates.service';
import * as proformaService from './proformaInvoices.service';
import * as invoicesService from './invoices.service';
import * as paymentsService from './payments.service';
import * as notesService from './creditDebitNotes.service';
import { sendSuccess, paramAsString } from '../../lib/apiResponse';
import { ScopedRequest } from '../../middleware/permission.middleware';
import { UnauthorizedError } from '../../lib/errors';

// --- Estimates ---
export async function createEstimateHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const estimate = await estimatesService.createEstimate(req.body, req.user);
    sendSuccess(res, estimate, 'Estimate created successfully', null, 201);
  } catch (err) {
    next(err);
  }
}

export async function listEstimatesHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const { items, meta } = await estimatesService.listEstimates(req.query as never);
    sendSuccess(res, items, 'Estimates fetched successfully', meta);
  } catch (err) {
    next(err);
  }
}

export async function getEstimateHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const estimate = await estimatesService.getEstimate(paramAsString(req.params.id));
    sendSuccess(res, estimate, 'Estimate fetched successfully');
  } catch (err) {
    next(err);
  }
}

export async function shareEstimateHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const { channels } = req.body as { channels: string[] };
    const estimate = await estimatesService.shareEstimate(paramAsString(req.params.id), channels, req.user);
    sendSuccess(res, estimate, 'Estimate shared successfully');
  } catch (err) {
    next(err);
  }
}

export async function approveEstimateHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const estimate = await estimatesService.respondToEstimate(paramAsString(req.params.id), true, req.user);
    sendSuccess(res, estimate, 'Estimate approved successfully');
  } catch (err) {
    next(err);
  }
}

export async function rejectEstimateHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const estimate = await estimatesService.respondToEstimate(paramAsString(req.params.id), false, req.user);
    sendSuccess(res, estimate, 'Estimate rejected');
  } catch (err) {
    next(err);
  }
}

export async function convertEstimateHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const proforma = await proformaService.convertEstimateToProforma(paramAsString(req.params.id), req.user);
    sendSuccess(res, proforma, 'Estimate converted to proforma invoice successfully', null, 201);
  } catch (err) {
    next(err);
  }
}

// --- Proforma Invoices ---
export async function listProformaInvoicesHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const { items, meta } = await proformaService.listProformaInvoices(req.query as never);
    sendSuccess(res, items, 'Proforma invoices fetched successfully', meta);
  } catch (err) {
    next(err);
  }
}

export async function getProformaInvoiceHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const proforma = await proformaService.getProformaInvoice(paramAsString(req.params.id));
    sendSuccess(res, proforma, 'Proforma invoice fetched successfully');
  } catch (err) {
    next(err);
  }
}

export async function shareProformaInvoiceHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const { channels } = req.body as { channels: string[] };
    const proforma = await proformaService.shareProformaInvoice(paramAsString(req.params.id), channels, req.user);
    sendSuccess(res, proforma, 'Proforma invoice shared successfully');
  } catch (err) {
    next(err);
  }
}

export async function acceptProformaInvoiceHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const proforma = await proformaService.acceptProformaInvoice(paramAsString(req.params.id), req.user);
    sendSuccess(res, proforma, 'Proforma invoice accepted successfully');
  } catch (err) {
    next(err);
  }
}

export async function convertProformaHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const invoice = await invoicesService.convertProformaToInvoice(paramAsString(req.params.id), req.user);
    sendSuccess(res, invoice, 'Proforma invoice converted to invoice successfully', null, 201);
  } catch (err) {
    next(err);
  }
}

// --- Invoices ---
export async function createDirectInvoiceHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const invoice = await invoicesService.createDirectInvoice(req.body, req.user);
    sendSuccess(res, invoice, 'Invoice created successfully', null, 201);
  } catch (err) {
    next(err);
  }
}

export async function listInvoicesHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const { items, meta } = await invoicesService.listInvoices(req.query as never);
    sendSuccess(res, items, 'Invoices fetched successfully', meta);
  } catch (err) {
    next(err);
  }
}

export async function getInvoiceHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const invoice = await invoicesService.getInvoice(paramAsString(req.params.id));
    sendSuccess(res, invoice, 'Invoice fetched successfully');
  } catch (err) {
    next(err);
  }
}

export async function shareInvoiceHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const { channels } = req.body as { channels: string[] };
    const invoice = await invoicesService.shareInvoice(paramAsString(req.params.id), channels);
    sendSuccess(res, invoice, 'Invoice shared successfully');
  } catch (err) {
    next(err);
  }
}

export async function cancelInvoiceHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const { reason } = req.body as { reason: string };
    const invoice = await invoicesService.cancelInvoice(paramAsString(req.params.id), reason, req.user);
    sendSuccess(res, invoice, 'Invoice cancelled successfully');
  } catch (err) {
    next(err);
  }
}

// --- Payments ---
export async function recordPaymentHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const receipt = await paymentsService.recordPayment(paramAsString(req.params.id), req.body, req.user);
    sendSuccess(res, receipt, 'Payment recorded successfully', null, 201);
  } catch (err) {
    next(err);
  }
}

export async function listPaymentsHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const receipts = await paymentsService.listPaymentsForInvoice(paramAsString(req.params.id));
    sendSuccess(res, receipts, 'Payment receipts fetched successfully');
  } catch (err) {
    next(err);
  }
}

export async function getPaymentReceiptHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const receipt = await paymentsService.getPaymentReceipt(paramAsString(req.params.id));
    sendSuccess(res, receipt, 'Payment receipt fetched successfully');
  } catch (err) {
    next(err);
  }
}

// --- Credit / Debit Notes ---
export async function issueCreditNoteHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const note = await notesService.issueCreditNote(req.body, req.user);
    sendSuccess(res, note, 'Credit note issued successfully', null, 201);
  } catch (err) {
    next(err);
  }
}

export async function issueDebitNoteHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const note = await notesService.issueDebitNote(req.body, req.user);
    sendSuccess(res, note, 'Debit note issued successfully', null, 201);
  } catch (err) {
    next(err);
  }
}
