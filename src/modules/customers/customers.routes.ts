import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  createCustomerSchema,
  updateCustomerSchema,
  addAddressSchema,
  updateAddressSchema,
  addProductSchema,
  updateConsentSchema,
  listCustomersQuerySchema,
} from './customers.validation';
import * as ctrl from './customers.controller';

const router = Router();

router.get('/customers', authMiddleware, requirePermission('customers', 'view'), validate(listCustomersQuerySchema, 'query'), ctrl.listCustomersHandler);
router.get('/customers/duplicates', authMiddleware, requirePermission('customers', 'view'), ctrl.findDuplicatesHandler);
router.get('/customers/me', authMiddleware, requirePermission('customers', 'view'), ctrl.getOwnCustomerHandler);
router.get('/customers/:id', authMiddleware, requirePermission('customers', 'view'), ctrl.getCustomerHandler);
router.post('/customers', authMiddleware, requirePermission('customers', 'create'), validate(createCustomerSchema), ctrl.createCustomerHandler);
router.patch('/customers/:id', authMiddleware, requirePermission('customers', 'edit'), validate(updateCustomerSchema), ctrl.updateCustomerHandler);
router.post('/customers/:id/addresses', authMiddleware, requirePermission('customers', 'edit'), validate(addAddressSchema), ctrl.addAddressHandler);
router.patch('/customers/:id/addresses/:addressId', authMiddleware, requirePermission('customers', 'edit'), validate(updateAddressSchema), ctrl.updateAddressHandler);
router.delete('/customers/:id/addresses/:addressId', authMiddleware, requirePermission('customers', 'edit'), ctrl.deleteAddressHandler);
router.get('/customers/:id/history', authMiddleware, requirePermission('customers', 'view'), ctrl.getCustomerHistoryHandler);
router.get('/customers/:id/products', authMiddleware, requirePermission('customers', 'view'), ctrl.listProductsHandler);
router.post('/customers/:id/products', authMiddleware, requirePermission('customers', 'edit'), validate(addProductSchema), ctrl.addProductHandler);
router.patch('/customers/:id/consent', authMiddleware, requirePermission('customers', 'edit'), validate(updateConsentSchema), ctrl.updateConsentHandler);

export default router;
