import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { globalSearchQuerySchema } from './search.validation';
import * as ctrl from './search.controller';

const router = Router();

// Any authenticated staff member can search — results only ever surface the
// same identifying fields (name/number/mobile/status) already visible on
// each entity's own list screen, not a bypass of any module's own
// permission-gated detail view, so no extra requirePermission gate here.
router.get('/search', authMiddleware, validate(globalSearchQuerySchema, 'query'), ctrl.globalSearchHandler);

export default router;
