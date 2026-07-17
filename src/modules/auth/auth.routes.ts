import { Router } from 'express';
import {
  loginHandler,
  refreshHandler,
  logoutHandler,
  otpRequestHandler,
  otpVerifyHandler,
  passwordResetRequestHandler,
  passwordResetHandler,
  meHandler,
  listSessionsHandler,
  revokeSessionHandler,
  revokeAllSessionsHandler,
} from './auth.controller';
import { validate } from '../../middleware/validate.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';
import {
  loginSchema,
  refreshSchema,
  otpRequestSchema,
  otpVerifySchema,
  passwordResetRequestSchema,
  passwordResetSchema,
} from './auth.validation';
import { authRateLimit, otpRateLimit } from '../../middleware/rateLimit.middleware';

// Routes match docs/11-complete-api-contracts.md §1.1 and §2 (Auth row).
const router = Router();

router.post('/login', authRateLimit, validate(loginSchema), loginHandler);
router.post('/refresh', validate(refreshSchema), refreshHandler);
router.post('/logout', validate(refreshSchema), logoutHandler);

router.post('/otp/request', otpRateLimit, validate(otpRequestSchema), otpRequestHandler);
router.post('/otp/verify', otpRateLimit, validate(otpVerifySchema), otpVerifyHandler);

router.post('/password/reset-request', authRateLimit, validate(passwordResetRequestSchema), passwordResetRequestHandler);
router.post('/password/reset', authRateLimit, validate(passwordResetSchema), passwordResetHandler);

router.get('/me', authMiddleware, meHandler);

router.get('/sessions', authMiddleware, listSessionsHandler);
router.delete('/sessions/:id', authMiddleware, revokeSessionHandler);
router.post('/sessions/revoke-all', authMiddleware, revokeAllSessionsHandler);

export default router;
