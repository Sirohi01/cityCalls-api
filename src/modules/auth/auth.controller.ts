import { Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { sendSuccess, paramAsString } from '../../lib/apiResponse';
import {
  LoginInput,
  RefreshInput,
  OtpRequestInput,
  OtpVerifyInput,
  PasswordResetRequestInput,
  PasswordResetInput,
} from './auth.validation';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { UnauthorizedError } from '../../lib/errors';

function sessionMeta(req: AuthenticatedRequest) {
  return {
    device: req.headers['user-agent'],
    ipAddress: req.ip,
  };
}

export async function loginHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { identifier, password } = req.body as LoginInput;
    const result = await authService.login(identifier, password, sessionMeta(req));
    sendSuccess(res, result, 'Login successful');
  } catch (err) {
    next(err);
  }
}

export async function refreshHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = req.body as RefreshInput;
    const result = await authService.refresh(refreshToken, sessionMeta(req));
    sendSuccess(res, result, 'Token refreshed successfully');
  } catch (err) {
    next(err);
  }
}

export async function logoutHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = req.body as RefreshInput;
    await authService.logout(refreshToken);
    sendSuccess(res, null, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
}

export async function otpRequestHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { mobile } = req.body as OtpRequestInput;
    await authService.requestOtp(mobile);
    sendSuccess(res, null, 'OTP sent successfully');
  } catch (err) {
    next(err);
  }
}

export async function otpVerifyHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { mobile, otp } = req.body as OtpVerifyInput;
    const result = await authService.verifyOtp(mobile, otp, sessionMeta(req));
    sendSuccess(res, result, 'Login successful');
  } catch (err) {
    next(err);
  }
}

export async function passwordResetRequestHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { identifier } = req.body as PasswordResetRequestInput;
    await authService.requestPasswordReset(identifier);
    sendSuccess(res, null, 'If an account matches, a reset link has been sent');
  } catch (err) {
    next(err);
  }
}

export async function passwordResetHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token, newPassword } = req.body as PasswordResetInput;
    await authService.resetPassword(token, newPassword);
    sendSuccess(res, null, 'Password reset successfully');
  } catch (err) {
    next(err);
  }
}

export async function listSessionsHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new UnauthorizedError();
    const sessions = await authService.listSessions(req.user.sub);
    sendSuccess(res, sessions, 'Sessions fetched successfully');
  } catch (err) {
    next(err);
  }
}

export async function revokeSessionHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new UnauthorizedError();
    await authService.revokeSession(req.user.sub, paramAsString(req.params.id));
    sendSuccess(res, null, 'Session revoked successfully');
  } catch (err) {
    next(err);
  }
}

export async function revokeAllSessionsHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new UnauthorizedError();
    await authService.revokeAllSessions(req.user.sub);
    sendSuccess(res, null, 'All sessions revoked successfully');
  } catch (err) {
    next(err);
  }
}
