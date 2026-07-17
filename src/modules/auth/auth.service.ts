import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { UserModel, IUser } from '../users/users.model';
import { SessionModel } from './sessions.model';
import { OtpModel } from './otp.model';
import { PasswordResetModel } from './passwordReset.model';
import { RolePermissionModel } from '../config/rolePermissions.model';
import { DataScope } from '../users/users.types';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt';
import { UnauthorizedError, NotFoundError, AppError } from '../../lib/errors';
import { env } from '../../config/env';
import { trigger } from '../../lib/notifications';

interface SessionMeta {
  device?: string;
  ipAddress?: string;
}

interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    role: IUser['role'];
    branchId?: string;
  };
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function refreshExpiryDate(): Date {
  const match = /^(\d+)([smhd])$/.exec(env.jwtRefreshExpiresIn);
  const amount = match ? parseInt(match[1], 10) : 7;
  const unit = match ? match[2] : 'd';
  const unitMs: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return new Date(Date.now() + amount * (unitMs[unit] ?? unitMs.d));
}

async function issueTokens(user: IUser, meta: SessionMeta): Promise<AuthResult> {
  const session = await SessionModel.create({
    userId: user._id,
    refreshTokenHash: 'pending',
    device: meta.device,
    ipAddress: meta.ipAddress,
    expiresAt: refreshExpiryDate(),
  });

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    role: user.role,
    branchId: user.branchId?.toString(),
    subBranchId: user.subBranchId?.toString(),
    teamId: user.teamId?.toString(),
    vendorId: user.vendorId?.toString(),
  });
  const refreshToken = signRefreshToken({ sub: user._id.toString(), sessionId: session._id.toString() });

  session.refreshTokenHash = hashToken(refreshToken);
  await session.save();

  return {
    accessToken,
    refreshToken,
    user: {
      id: user._id.toString(),
      name: user.name,
      role: user.role,
      branchId: user.branchId?.toString(),
    },
  };
}

export async function login(identifier: string, password: string, meta: SessionMeta): Promise<AuthResult> {
  const isEmail = identifier.includes('@');
  const user = await UserModel.findOne(
    isEmail ? { email: identifier.toLowerCase() } : { mobile: identifier }
  ).select('+passwordHash');

  if (!user || user.status !== 'ACTIVE') {
    throw new UnauthorizedError('Incorrect email/mobile or password');
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw new UnauthorizedError('Incorrect email/mobile or password');
  }

  user.lastLoginAt = new Date();
  await user.save();

  return issueTokens(user, meta);
}

export async function refresh(refreshToken: string, meta: SessionMeta): Promise<AuthResult> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  const session = await SessionModel.findById(payload.sessionId);
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw new UnauthorizedError('Session no longer valid');
  }
  if (session.refreshTokenHash !== hashToken(refreshToken)) {
    // Token reuse/mismatch — revoke defensively.
    session.revokedAt = new Date();
    await session.save();
    throw new UnauthorizedError('Session no longer valid');
  }

  const user = await UserModel.findById(payload.sub);
  if (!user || user.status !== 'ACTIVE') {
    throw new UnauthorizedError('Account is no longer active');
  }

  // Rotate: revoke old session, issue a new one.
  session.revokedAt = new Date();
  await session.save();

  return issueTokens(user, meta);
}

export async function logout(refreshToken: string): Promise<void> {
  try {
    const payload = verifyRefreshToken(refreshToken);
    await SessionModel.findByIdAndUpdate(payload.sessionId, { revokedAt: new Date() });
  } catch {
    // Already invalid/expired — logout is idempotent, nothing more to do.
  }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

// docs/manish/04-authentication-and-rbac-plan.md §1: OTP-based login, primarily for the customer app.
export async function requestOtp(mobile: string): Promise<void> {
  const otp = generateOtp();
  const otpHash = hashToken(otp);

  await OtpModel.create({
    mobile,
    otpHash,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes, per docs/17 §4
  });

  await trigger('OTP_LOGIN', { recipient: { mobile }, variables: { otp } });
}

export async function verifyOtp(mobile: string, otp: string, meta: SessionMeta): Promise<AuthResult> {
  const record = await OtpModel.findOne({ mobile }).sort({ createdAt: -1 });
  if (!record || record.verified || record.expiresAt < new Date()) {
    throw new UnauthorizedError('OTP expired or not found. Please request a new one.');
  }
  if (record.attempts >= 5) {
    throw new UnauthorizedError('Too many incorrect attempts. Please request a new OTP.');
  }
  if (record.otpHash !== hashToken(otp)) {
    record.attempts += 1;
    await record.save();
    throw new UnauthorizedError('Incorrect OTP');
  }

  record.verified = true;
  await record.save();

  // Progressive registration: OTP login auto-creates a CUSTOMER account on first use,
  // since customer accounts don't necessarily pre-exist (docs/manish/08 §1).
  let user = await UserModel.findOne({ mobile });
  if (!user) {
    const placeholderPasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
    user = await UserModel.create({
      name: 'Customer',
      mobile,
      passwordHash: placeholderPasswordHash,
      role: 'CUSTOMER',
      status: 'ACTIVE',
    });
  }
  if (user.status !== 'ACTIVE') {
    throw new UnauthorizedError('Account is no longer active');
  }

  user.lastLoginAt = new Date();
  await user.save();

  return issueTokens(user, meta);
}

// docs/manish/04-authentication-and-rbac-plan.md §1: time-limited, single-use email link.
export async function requestPasswordReset(identifier: string): Promise<void> {
  const isEmail = identifier.includes('@');
  const user = await UserModel.findOne(isEmail ? { email: identifier.toLowerCase() } : { mobile: identifier });

  // Always succeed from the caller's perspective even if no account matches —
  // does not confirm/deny account existence to an unauthenticated caller.
  if (!user) return;

  const token = crypto.randomBytes(32).toString('hex');
  await PasswordResetModel.create({
    userId: user._id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
  });

  const resetUrl = `${env.corsAllowedOrigins[0]}/reset-password?token=${token}`;
  await trigger('PASSWORD_RESET', {
    recipient: { userId: user._id.toString(), email: user.email, mobile: user.mobile },
    variables: { token, userId: user._id.toString(), resetUrl },
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = hashToken(token);
  const record = await PasswordResetModel.findOne({ tokenHash, usedAt: { $exists: false } });
  if (!record || record.expiresAt < new Date()) {
    throw new AppError(400, 'Invalid or expired reset link', [
      { field: 'token', code: 'INVALID_RESET_TOKEN', message: 'This reset link is invalid or has expired' },
    ]);
  }

  const user = await UserModel.findById(record.userId);
  if (!user) throw new NotFoundError('Account not found');

  user.passwordHash = await hashPassword(newPassword);
  await user.save();

  record.usedAt = new Date();
  await record.save();

  // Forced logout on password change — revoke every active session (docs/17-security-and-audit.md §9).
  await SessionModel.updateMany({ userId: user._id, revokedAt: { $exists: false } }, { revokedAt: new Date() });
}

// Session management — docs/17-security-and-audit.md §9: users can revoke their own
// sessions; Super Admin/Admin can revoke any user's (enforced at the route/permission layer).
export async function listSessions(userId: string) {
  return SessionModel.find({ userId, revokedAt: { $exists: false }, expiresAt: { $gt: new Date() } })
    .select('-refreshTokenHash')
    .sort({ createdAt: -1 });
}

export async function revokeSession(userId: string, sessionId: string): Promise<void> {
  const session = await SessionModel.findOne({ _id: sessionId, userId });
  if (!session) throw new NotFoundError('Session not found');
  session.revokedAt = new Date();
  await session.save();
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await SessionModel.updateMany({ userId, revokedAt: { $exists: false } }, { revokedAt: new Date() });
}

// docs/manish/10-admin-functional-integration-plan.md §3: exposes the
// current user's profile plus their RESOLVED permission set (not just role
// name), so the frontend's usePermission(module, action) hook can check
// access without re-deriving the server-side permission matrix itself.
// Shape: permissions[module][action] = dataScope, so a real access check is
// `Boolean(permissions[module]?.[action])` — absence means no grant.
export async function getMe(userId: string) {
  const user = await UserModel.findById(userId);
  if (!user) throw new NotFoundError('User not found');

  const grants = await RolePermissionModel.find({ role: user.role }).lean();
  const permissions: Record<string, Record<string, DataScope>> = {};
  for (const g of grants) {
    permissions[g.module] = permissions[g.module] ?? {};
    permissions[g.module][g.action] = g.dataScope;
  }

  const obj = user.toObject();
  delete (obj as { passwordHash?: string }).passwordHash;
  return { ...obj, permissions };
}
