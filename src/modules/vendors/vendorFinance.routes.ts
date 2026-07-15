import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  createVendorInvoiceSchema,
  createVendorPayoutSchema,
  markPayoutPaidSchema,
  listVendorFinanceQuerySchema,
} from './vendorFinance.validation';
import * as ctrl from './vendorFinance.controller';

const router = Router();

router.get('/vendor-invoices', authMiddleware, requirePermission('vendors', 'viewFinancial'), validate(listVendorFinanceQuerySchema, 'query'), ctrl.listVendorInvoicesHandler);
router.post('/vendor-invoices', authMiddleware, requirePermission('vendors', 'viewFinancial'), validate(createVendorInvoiceSchema), ctrl.createVendorInvoiceHandler);
router.patch('/vendor-invoices/:id/approve', authMiddleware, requirePermission('vendors', 'viewFinancial'), ctrl.approveVendorInvoiceHandler);

router.get('/vendor-payouts', authMiddleware, requirePermission('vendors', 'viewFinancial'), validate(listVendorFinanceQuerySchema, 'query'), ctrl.listVendorPayoutsHandler);
router.post('/vendor-payouts', authMiddleware, requirePermission('vendors', 'viewFinancial'), validate(createVendorPayoutSchema), ctrl.createVendorPayoutHandler);
router.patch('/vendor-payouts/:id/mark-paid', authMiddleware, requirePermission('vendors', 'viewFinancial'), validate(markPayoutPaidSchema), ctrl.markPayoutPaidHandler);

export default router;
