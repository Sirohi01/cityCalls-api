import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { UserModel, IUser } from '../users/users.model';
import { SessionModel } from './sessions.model';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt';
import { UnauthorizedError } from '../../lib/errors';
import { env } from '../../config/env';

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
