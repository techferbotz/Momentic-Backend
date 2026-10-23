import type { ConfigRule } from './dto/remoteConfig.dto';

/**
 * Targeting rules, in the order they apply. EMPTY today: every caller gets the
 * default document (plus any REMOTE_CONFIG_OVERRIDES). This array is the seam for:
 *
 *   - a per-version config, e.g.
 *       matches: (ctx) => ctx.platform === 'android' && ctx.appBuild !== null && ctx.appBuild < 120,
 *       patch:   { features: { renewal: false } }
 *   - an experiment: bucket DETERMINISTICALLY on the install so a person stays
 *     in one arm across launches — `ctx.deviceId !== null && bucketOf(ctx.deviceId, 'exp-2026-11') < 50`,
 *     where bucketOf hashes (deviceId + experiment key) to 0..99. X-Device-Id is
 *     optional, so guard the null: no install id, no experiment.
 *   - a per-user override for QA: matches: (ctx) => ctx.userId === '<id>'.
 *
 * To add a rule, write it below and add it here — nothing else changes. Patches
 * are typed against RemoteConfig and validated against the defaults at startup.
 * Rules must be pure and fast: this runs on every app launch and must not touch
 * the database.
 */
export const RULES: ConfigRule[] = [];
