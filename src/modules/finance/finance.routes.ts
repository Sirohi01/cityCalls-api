import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  createEstimateSchema,
  shareDocumentSchema,
  createDirectInvoiceSchema,
  cancelInvoiceSchema,
  recordPaymentSchema,
  issueNoteSchema,
  listFinanceQuerySchema,
} from './finance.validation';
import * as ctrl from './finance.controller';

const router = Router();

// Estimates
router.get('/estimates', authMiddleware, requirePermission('finance', 'view'), validate(listFinanceQuerySchema, 'query'), ctrl.listEstimatesHandler);
router.get('/estimates/:id', authMiddleware, requirePermission('finance', 'view'), ctrl.getEstimateHandler);
router.post('/estimates', authMiddleware, requirePermission('finance', 'create'), validate(createEstimateSchema), ctrl.createEstimateHandler);
router.post('/estimates/:id/share', authMiddleware, requirePermission('finance', 'edit'), validate(shareDocumentSchema), ctrl.shareEstimateHandler);
router.patch('/estimates/:id/approve', authMiddleware, requirePermission('finance', 'edit'), ctrl.approveEstimateHandler);
router.patch('/estimates/:id/reject', authMiddleware, requirePermission('finance', 'edit'), ctrl.rejectEstimateHandler);
router.post('/estimates/:id/convert', authMiddleware, requirePermission('finance', 'edit'), ctrl.convertEstimateHandler);

// Proforma Invoices
router.get('/proforma-invoices', authMiddleware, requirePermission('finance', 'view'), validate(listFinanceQuerySchema, 'query'), ctrl.listProformaInvoicesHandler);
router.get('/proforma-invoices/:id', authMiddleware, requirePermission('finance', 'view'), ctrl.getProformaInvoiceHandler);
router.post('/proforma-invoices/:id/share', authMiddleware, requirePermission('finance', 'edit'), validate(shareDocumentSchema), ctrl.shareProformaInvoiceHandler);
router.patch('/proforma-invoices/:id/accept', authMiddleware, requirePermission('finance', 'edit'), ctrl.acceptProformaInvoiceHandler);
router.post('/proforma-invoices/:id/convert', authMiddleware, requirePermission('finance', 'edit'), ctrl.convertProformaHandler);

// Invoices
router.get('/invoices', authMiddleware, requirePermission('finance', 'view'), validate(listFinanceQuerySchema, 'query'), ctrl.listInvoicesHandler);
router.get('/invoices/:id', authMiddleware, requirePermission('finance', 'view'), ctrl.getInvoiceHandler);
router.post('/invoices', authMiddleware, requirePermission('finance', 'create'), validate(createDirectInvoiceSchema), ctrl.createDirectInvoiceHandler);
router.post('/invoices/:id/share', authMiddleware, requirePermission('finance', 'edit'), validate(shareDocumentSchema), ctrl.shareInvoiceHandler);
router.post('/invoices/:id/cancel', authMiddleware, requirePermission('finance', 'edit'), validate(cancelInvoiceSchema), ctrl.cancelInvoiceHandler);
router.post('/invoices/:id/payments', authMiddleware, requirePermission('finance', 'edit'), validate(recordPaymentSchema), ctrl.recordPaymentHandler);
router.get('/invoices/:id/payments', authMiddleware, requirePermission('finance', 'view'), ctrl.listPaymentsHandler);

// Payment Receipts
router.get('/payment-receipts/:id', authMiddleware, requirePermission('finance', 'view'), ctrl.getPaymentReceiptHandler);

// Credit / Debit Notes
router.post('/credit-notes', authMiddleware, requirePermission('finance', 'edit'), validate(issueNoteSchema), ctrl.issueCreditNoteHandler);
router.post('/debit-notes', authMiddleware, requirePermission('finance', 'edit'), validate(issueNoteSchema), ctrl.issueDebitNoteHandler);

export default router;
