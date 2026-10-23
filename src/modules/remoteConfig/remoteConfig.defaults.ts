import { env } from '../../config/env';
import { CREATION_LIMITS, RATE_LIMITS, RENDER, UPLOAD } from '../../config/constants';
import { LEGAL_CONTACT_EMAIL, LEGAL_PATHS } from '../legal/legal.view';
import type { RemoteConfig } from './dto/remoteConfig.dto';

/** Bump when a key is REMOVED or RENAMED. Adding keys: no bump. */
export const SCHEMA_VERSION = 1;

/**
 * How long the app may use a fetched document. It also re-fetches on every cold
 * start, so a flipped switch reaches everyone within an hour or one restart.
 */
export const TTL_SECONDS = 60 * 60;

/**
 * What every app gets today. Where the server already has a constant for a value
 * it is IMPORTED, so the number the app shows can't drift from the number the
 * server enforces.
 *
 * To change a value for everyone: edit here and deploy. To change it without a
 * deploy: set REMOTE_CONFIG_OVERRIDES in the server's .env and recreate the
 * container (docs/REMOTE_CONFIG.md). Per-caller variations belong in
 * remoteConfig.rules.ts.
 */
export const DEFAULT_REMOTE_CONFIG: RemoteConfig = {
  features: {
    googleLogin: true,
    publishing: true,
    renewal: true,
    stats: true,
  },
  update: {
    minSupportedBuild: 0,
    recommendedBuild: 0,
    // Set once the store listings exist.
    androidStoreUrl: null,
    iosStoreUrl: null,
    message: null,
  },
  maintenance: {
    enabled: false,
    message: null,
  },
  limits: {
    maxUploadBytes: UPLOAD.maxBytes,
    uploadMimeTypes: [...UPLOAD.allowedMimeTypes],
    uploadsPerHour: RATE_LIMITS.upload.limit,
    maxDrafts: CREATION_LIMITS.maxDraftsPerPrincipal,
    maxImages: CREATION_LIMITS.maxImagesPerPrincipal,
    draftPreviewMinutes: RENDER.draftTokenTtlSeconds / 60,
  },
  web: {
    origin: env.publicWebOrigin,
  },
  links: {
    privacyPolicy: `${env.publicWebOrigin}${LEGAL_PATHS.privacy}`,
    terms: `${env.publicWebOrigin}${LEGAL_PATHS.terms}`,
    deleteAccount: `${env.publicWebOrigin}${LEGAL_PATHS.deleteAccount}`,
    supportEmail: LEGAL_CONTACT_EMAIL,
  },
};
