import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { sendSuccess } from '../../lib/apiResponse';
import { LoginInput, RefreshInput } from './auth.validation';

function sessionMeta(req: Request) {
  return {
    device: req.headers['user-agent'],
    ipAddress: req.ip,
  };
}

export async function loginHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { identifier, password } = req.body as LoginInput;
    const result = await authService.login(identifier, password, sessionMeta(req));
    sendSuccess(res, result, 'Login successful');
  } catch (err) {
    next(err);
  }
}

export async function refreshHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = req.body as RefreshInput;
    const result = await authService.refresh(refreshToken, sessionMeta(req));
    sendSuccess(res, result, 'Token refreshed successfully');
  } catch (err) {
    next(err);
  }
}

export async function logoutHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = req.body as RefreshInput;
    await authService.logout(refreshToken);
    sendSuccess(res, null, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
}
