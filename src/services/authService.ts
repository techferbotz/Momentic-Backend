import type { User } from '@prisma/client';
import { env } from '../config/env';
import { ErrorCode, ForbiddenError, NotFoundError, UnauthorizedError } from '../errors/AppError';
import { signAccessToken, verifyAccessToken } from '../auth/jwt';
import { verifyGoogleIdToken } from '../auth/googleAuth';
import * as userRepo from '../repositories/userRepo';
import * as draftSessionService from './draftSessionService';
import { safeCompare } from '../utils/crypto';
import { logger } from '../utils/logger';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface AuthSession {
  /** Never expires unless JWT_EXPIRES_IN says otherwise (HOA protocol 04). */
  accessToken: string;
  user: PublicUser;
  claimed?: { creations: number; images: number };
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
  };
}

/**
 * Sign-in happens at publish time, so the caller can hand us the device's draft
 * token and have its work adopted in the same round trip — that moment is the
 * conversion point and every extra call is a chance to lose the user.
 */
export async function loginWithGoogle(
  idToken: string,
  draftToken?: string,
): Promise<AuthSession> {
  const identity = await verifyGoogleIdToken(idToken);
  const user = await userRepo.upsertFromGoogle(identity);

  const claimed = draftToken ? await draftSessionService.claim(draftToken, user.id) : undefined;

  return {
    accessToken: signAccessToken(user.id),
    user: toPublicUser(user),
    ...(claimed ? { claimed } : {}),
  };
}

/**
 * Turns a bearer token into a user id, or rejects it.
 *
 * The token never expires, so a signature check alone would keep a deleted
 * account working forever. One primary-key lookup per signed-in request is the
 * price of deletion meaning deletion. Signing back in with the same Google
 * account restores the account, and with it any token it still holds.
 */
export async function authenticate(token: string): Promise<string> {
  const { userId } = verifyAccessToken(token);
  const user = await userRepo.findActiveById(userId);
  if (!user) {
    logger.warn('Access token rejected', { reason: 'account deleted or missing' });
    throw new UnauthorizedError('Invalid access token', ErrorCode.INVALID_TOKEN);
  }
  return userId;
}

export async function getProfile(userId: string): Promise<PublicUser> {
  const user = await userRepo.findActiveById(userId);
  if (!user) throw new NotFoundError('Account not found', ErrorCode.NOT_FOUND);
  return toPublicUser(user);
}

export async function deleteAccount(userId: string): Promise<void> {
  const user = await userRepo.findActiveById(userId);
  if (!user) throw new NotFoundError('Account not found', ErrorCode.NOT_FOUND);
  await userRepo.softDelete(userId);
}

export async function claimDrafts(
  draftToken: string,
  userId: string,
): Promise<{ creations: number; images: number }> {
  return draftSessionService.claim(draftToken, userId);
}

/**
 * Development-only sign-in. Google ID tokens can't be minted from a smoke test,
 * so this stands in for one. `env.ts` refuses to boot a production process that
 * carries the secret, which is the guard that actually matters.
 */
export async function testLogin(secret: string, email: string): Promise<AuthSession> {
  if (!env.testLoginSecret || !env.isDevelopment) {
    throw new NotFoundError('Route not found', ErrorCode.NOT_FOUND);
  }
  if (!safeCompare(secret, env.testLoginSecret)) {
    throw new ForbiddenError('Invalid test login secret');
  }

  const user = await userRepo.upsertFromGoogle({
    googleSub: `test:${email}`,
    email,
    name: email.split('@')[0] ?? 'Tester',
    avatarUrl: null,
  });
  return { accessToken: signAccessToken(user.id), user: toPublicUser(user) };
}
