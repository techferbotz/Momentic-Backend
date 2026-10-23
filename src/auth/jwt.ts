import jwt, { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { RENDER } from '../config/constants';
import { ErrorCode, NotFoundError, UnauthorizedError } from '../errors/AppError';
import { logger } from '../utils/logger';

/** The only module that imports jsonwebtoken. */

const ISSUER = 'momentica';
const AUDIENCE = 'momentica-app';
/** Separate audience so an access token can never stand in for a preview token. */
const PREVIEW_AUDIENCE = 'momentica-draft-preview';

export interface AccessTokenClaims {
  userId: string;
}

/**
 * HOA protocol 04: the access token never expires by default. With
 * `JWT_EXPIRES_IN` unset the token carries no `exp` claim at all, so a signed-in
 * creator is never sent back to sign-in by the clock, and there is no refresh
 * token because there is nothing to refresh. Rotating JWT_SECRET is the only way
 * to invalidate issued tokens, and it signs every user out at once.
 *
 * Carries identity only. Entitlement lives in the database: a token minted
 * before a purchase would otherwise deny access the user has already paid for.
 */
export function signAccessToken(userId: string): string {
  const options: SignOptions = {
    subject: userId,
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithm: 'HS256',
    // env.ts validated the value against the grammar `expiresIn` accepts.
    ...(env.jwtExpiresIn === null
      ? {}
      : { expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'] }),
  };
  return jwt.sign({}, env.jwtSecret, options);
}

/**
 * The 401 stays opaque, but the reason is logged — "invalid signature" (a
 * rotated secret), "jwt audience invalid" (another environment's token) — since
 * an opaque 401 that logs nothing is undiagnosable. Never logs the token.
 */
export function verifyAccessToken(token: string): AccessTokenClaims {
  try {
    const payload = jwt.verify(token, env.jwtSecret, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    });
    const userId = typeof payload === 'string' ? undefined : payload.sub;
    if (!userId) throw new Error('missing subject');
    return { userId };
  } catch (err) {
    logger.warn('Access token rejected', { reason: tokenRejectionReason(err) });
    throw new UnauthorizedError('Invalid access token', ErrorCode.INVALID_TOKEN);
  }
}

function tokenRejectionReason(err: unknown): string {
  // Checked first: TokenExpiredError extends JsonWebTokenError.
  if (err instanceof TokenExpiredError) return `jwt expired at ${err.expiredAt.toISOString()}`;
  if (err instanceof JsonWebTokenError) return err.message;
  return err instanceof Error ? err.message : 'unknown error';
}

/**
 * Short-lived link that lets the renderer show a creator their own unpaid draft.
 * Signed rather than stored: it expires on its own and needs no cleanup, and the
 * draft it names is worthless to anyone else.
 */
export function signDraftPreviewToken(creationId: string): { token: string; expiresAt: Date } {
  const expiresIn = RENDER.draftTokenTtlSeconds;
  const token = jwt.sign({}, env.jwtSecret, {
    subject: creationId,
    issuer: ISSUER,
    audience: PREVIEW_AUDIENCE,
    algorithm: 'HS256',
    expiresIn,
  });
  return { token, expiresAt: new Date(Date.now() + expiresIn * 1000) };
}

export function verifyDraftPreviewToken(token: string): { creationId: string } {
  try {
    const payload = jwt.verify(token, env.jwtSecret, {
      issuer: ISSUER,
      audience: PREVIEW_AUDIENCE,
      algorithms: ['HS256'],
    });
    const creationId = typeof payload === 'string' ? undefined : payload.sub;
    if (!creationId) throw new Error('missing subject');
    return { creationId };
  } catch {
    // Reported as absent, not rejected: to a recipient an expired preview link
    // and a made-up one are the same thing, and saying which is which would
    // confirm that a particular draft exists.
    throw new NotFoundError('This preview link has expired', ErrorCode.NOT_FOUND);
  }
}
