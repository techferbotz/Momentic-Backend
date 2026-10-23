import type { Request } from 'express';
import type { ConfigContext, Platform } from './dto/remoteConfig.dto';

/**
 * Optional headers describing the build that is asking. Missing or garbled
 * values degrade to null / "unknown" — never a 400 — because the config must
 * always be fetchable; a rule that needs a value the caller didn't send simply
 * doesn't match.
 */
export const APP_VERSION_HEADER = 'X-App-Version';
export const APP_BUILD_HEADER = 'X-App-Build';
export const APP_PLATFORM_HEADER = 'X-App-Platform';
export const DEVICE_ID_HEADER = 'X-Device-Id';

const PLATFORMS: readonly string[] = ['android', 'ios', 'web'];

export interface RawContextHeaders {
  platform?: string;
  version?: string;
  build?: string;
}

function parsePlatform(raw: string | undefined): Platform {
  const value = raw?.trim().toLowerCase() ?? '';
  return PLATFORMS.includes(value) ? (value as Platform) : 'unknown';
}

/** A non-negative integer. Anything else ("", "1.2", "abc", too long) → null. */
function parseBuild(raw: string | undefined): number | null {
  const value = raw?.trim() ?? '';
  return /^\d{1,12}$/.test(value) ? Number(value) : null;
}

/** Kept opaque and capped: it is for logging, not parsing. */
function parseVersion(raw: string | undefined): string | null {
  const value = raw?.trim() ?? '';
  return value ? value.slice(0, 32) : null;
}

/** The pure half — what check:config exercises. */
export function parseContextHeaders(
  headers: RawContextHeaders,
  identity: { deviceId: string | null; userId: string | null },
): ConfigContext {
  return {
    deviceId: identity.deviceId,
    userId: identity.userId,
    platform: parsePlatform(headers.platform),
    appVersion: parseVersion(headers.version),
    appBuild: parseBuild(headers.build),
  };
}

/**
 * The Express half. The install id is read straight from its header; the user
 * id is whatever `optionalAuth` attached.
 */
export function contextFromRequest(req: Request): ConfigContext {
  const deviceId = req.header(DEVICE_ID_HEADER)?.trim().slice(0, 128) || null;
  return parseContextHeaders(
    {
      platform: req.header(APP_PLATFORM_HEADER),
      version: req.header(APP_VERSION_HEADER),
      build: req.header(APP_BUILD_HEADER),
    },
    { deviceId, userId: req.userId ?? null },
  );
}
