import { Router } from 'express';
import { loginHandler, refreshHandler, logoutHandler } from './auth.controller';
import { validate } from '../../middleware/validate.middleware';
import { loginSchema, refreshSchema } from './auth.validation';
import { authRateLimit } from '../../middleware/rateLimit.middleware';

// Routes match docs/11-complete-api-contracts.md §1.1 and §2 (Auth row).
// OTP endpoints (customer app) and password-reset are stubbed for a later pass —
// see docs/manish/04-authentication-and-rbac-plan.md §1.
const router = Router();

router.post('/login', authRateLimit, validate(loginSchema), loginHandler);
router.post('/refresh', validate(refreshSchema), refreshHandler);
router.post('/logout', validate(refreshSchema), logoutHandler);

export default router;
