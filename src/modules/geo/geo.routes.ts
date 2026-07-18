import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import * as ctrl from './geo.controller';

const router = Router();
router.get('/geo/pincode/:pincode', authMiddleware, ctrl.checkAreaHandler);

export default router;
