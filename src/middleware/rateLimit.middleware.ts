import rateLimit from 'express-rate-limit';

// Limits per docs/17-security-and-audit.md §4.
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20, // per IP; per-identifier limiting is layered on top in auth.service if needed
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again later.',
    data: null,
    errors: [{ field: 'general', code: 'RATE_LIMITED', message: 'Too many login attempts' }],
  },
});

// Per docs/17-security-and-audit.md §4: 3/10min per mobile number, ideally — this is
// IP-scoped for now (express-rate-limit's default keying); per-identifier limiting
// would need a custom store keyed by request body, not yet built.
export const otpRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many OTP requests. Please try again later.',
    data: null,
    errors: [{ field: 'general', code: 'RATE_LIMITED', message: 'Too many OTP requests' }],
  },
});

export const generalApiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please slow down.',
    data: null,
    errors: [{ field: 'general', code: 'RATE_LIMITED', message: 'Too many requests' }],
  },
});

export const publicApiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please slow down.',
    data: null,
    errors: [{ field: 'general', code: 'RATE_LIMITED', message: 'Too many requests' }],
  },
});
