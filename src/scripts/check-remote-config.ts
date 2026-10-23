/**
 * Fixtures for GET /config (HOA protocol 10): the strict merge, header parsing,
 * the resolve order (defaults → env overrides → rules), fail-fast on bad input,
 * and the live route. No database.
 *
 *   npm run check:config
 */

// env.ts refuses to boot without these; none is used here. Only MISSING values
// are filled, so a real .env still wins.
process.env.DATABASE_URL ??= 'postgresql://check:check@localhost:5432/check';
process.env.JWT_SECRET ??= 'check-placeholder-secret-of-at-least-32-chars';
process.env.GOOGLE_CLIENT_ID ??= 'check.apps.googleusercontent.com';
process.env.PUBLIC_WEB_ORIGIN ??= 'https://momentic.ferbotz.com';

import type { AddressInfo } from 'node:net';
import { createApp } from '../app';
import { RATE_LIMITS, UPLOAD } from '../config/constants';
import { env } from '../config/env';
import { signAccessToken } from '../auth/jwt';
import { deepMergeStrict, MergeError } from '../utils/deepMerge';
import type { ConfigContext, ConfigRule } from '../modules/remoteConfig/dto/remoteConfig.dto';
import { DEFAULT_REMOTE_CONFIG, TTL_SECONDS } from '../modules/remoteConfig/remoteConfig.defaults';
import { parseContextHeaders } from '../modules/remoteConfig/remoteConfig.context';
import { RemoteConfigService } from '../modules/remoteConfig/service/remoteConfig.service';
import { RULES } from '../modules/remoteConfig/remoteConfig.rules';
import { check, expectEqual, expectThrows, expectTrue, report } from './checkUtil';

const anon: ConfigContext = {
  deviceId: 'device-1',
  userId: null,
  platform: 'unknown',
  appVersion: null,
  appBuild: null,
};
/** A first launch that has not generated an install id yet. */
const noDevice: ConfigContext = { ...anon, deviceId: null };

const service = (
  overrides: Record<string, unknown> | null = null,
  rules: ConfigRule[] = [],
): RemoteConfigService =>
  new RemoteConfigService({ defaults: DEFAULT_REMOTE_CONFIG, overrides, rules });

function expectMergeError(fn: () => unknown, pattern: RegExp | null, what: string): void {
  const err = expectThrows(fn, what);
  expectTrue(err instanceof MergeError, `${what}: expected a MergeError, got ${String(err)}`);
  if (pattern) expectTrue(pattern.test((err as Error).message), `${what}: ${(err as Error).message}`);
}

async function main(): Promise<void> {
  // ---- deepMergeStrict -----------------------------------------------------
  await check('merge: a nested patch applies and neither input is mutated', () => {
    const base = { a: { b: true, c: 1 }, d: 'x' };
    const patch = { a: { b: false } };
    expectEqual(deepMergeStrict(base, patch), { a: { b: false, c: 1 }, d: 'x' }, 'merged');
    expectEqual(base, { a: { b: true, c: 1 }, d: 'x' }, 'base untouched');
    expectEqual(patch, { a: { b: false } }, 'patch untouched');
  });

  await check('merge: an unknown key throws, naming the full path', () => {
    expectMergeError(
      () => deepMergeStrict({ a: { b: true } }, { a: { bee: true } }, 'X'),
      /X\.a\.bee: unknown key/,
      'unknown key',
    );
  });

  await check('merge: a type mismatch throws', () => {
    expectMergeError(() => deepMergeStrict({ a: true }, { a: 'true' }), null, 'string for boolean');
    expectMergeError(() => deepMergeStrict({ a: 1 }, { a: { n: 1 } }), null, 'object for number');
    expectMergeError(() => deepMergeStrict({ a: { b: 1 } }, { a: 5 }), null, 'number for object');
    expectMergeError(() => deepMergeStrict({ a: 1 }, 'not an object'), null, 'non-object patch');
  });

  await check('merge: null clears a primitive, never an object; a null base takes a primitive', () => {
    expectEqual(deepMergeStrict({ a: 'x' as string | null }, { a: null }), { a: null }, 'cleared');
    expectMergeError(() => deepMergeStrict({ a: { b: 1 } }, { a: null }), null, 'null object');
    expectEqual(deepMergeStrict({ a: null as string | null }, { a: 'set' }), { a: 'set' }, 'set');
    expectMergeError(() => deepMergeStrict({ a: null }, { a: { b: 1 } }), null, 'structure into null');
  });

  await check('merge: arrays are replaced wholesale', () => {
    expectEqual(deepMergeStrict({ a: [1, 2, 3] }, { a: [9] }), { a: [9] }, 'replaced');
    expectMergeError(() => deepMergeStrict({ a: [1] }, { a: '9' }), null, 'string for array');
  });

  // ---- header parsing ------------------------------------------------------
  await check('context: well-formed headers parse', () => {
    expectEqual(
      parseContextHeaders(
        { platform: 'Android', version: '1.4.2', build: '1042' },
        { deviceId: 'd', userId: 'u' },
      ),
      { deviceId: 'd', userId: 'u', platform: 'android', appVersion: '1.4.2', appBuild: 1042 },
      'context',
    );
  });

  await check('context: missing or garbled headers degrade, never throw', () => {
    expectEqual(
      parseContextHeaders(
        { platform: 'windows-phone', version: '   ', build: '1.2' },
        { deviceId: 'd', userId: null },
      ),
      { deviceId: 'd', userId: null, platform: 'unknown', appVersion: null, appBuild: null },
      'garbled',
    );
    expectEqual(
      parseContextHeaders({ build: '-5' }, { deviceId: null, userId: null }).appBuild,
      null,
      'negative build',
    );
    expectEqual(
      parseContextHeaders({}, { deviceId: null, userId: null }),
      { deviceId: null, userId: null, platform: 'unknown', appVersion: null, appBuild: null },
      'no identity at all',
    );
  });

  // ---- defaults ------------------------------------------------------------
  await check('defaults: JSON-clean, absolute https links, day-one behaviour', () => {
    expectEqual(JSON.parse(JSON.stringify(DEFAULT_REMOTE_CONFIG)), DEFAULT_REMOTE_CONFIG, 'round trip');
    for (const [key, value] of Object.entries(DEFAULT_REMOTE_CONFIG.links)) {
      if (key === 'supportEmail') {
        expectTrue(/^[^@\s]+@[^@\s]+$/.test(value), `links.${key} is an email`);
      } else {
        expectTrue(/^https:\/\//.test(value), `links.${key} must be absolute https, got ${value}`);
      }
    }
    expectTrue(Object.values(DEFAULT_REMOTE_CONFIG.features).every((on) => on), 'every feature on');
    expectEqual(DEFAULT_REMOTE_CONFIG.maintenance.enabled, false, 'maintenance off');
    expectEqual(DEFAULT_REMOTE_CONFIG.update.minSupportedBuild, 0, 'no forced update');
  });

  await check('defaults: limits are mirrored from the enforcing constants', () => {
    expectEqual(DEFAULT_REMOTE_CONFIG.limits.maxUploadBytes, UPLOAD.maxBytes, 'upload cap');
    expectEqual(DEFAULT_REMOTE_CONFIG.limits.uploadsPerHour, RATE_LIMITS.upload.limit, 'upload rate');
    expectEqual(DEFAULT_REMOTE_CONFIG.web.origin, env.publicWebOrigin, 'web origin');
  });

  // ---- resolution ----------------------------------------------------------
  await check('resolve: no overrides, no rules → the defaults, variant "default"', () => {
    const dto = service().resolve(anon);
    expectEqual(dto.variant, 'default', 'variant');
    expectEqual(dto.ttlSeconds, TTL_SECONDS, 'ttl');
    expectTrue(/^[0-9a-f]{12}$/.test(dto.revision), `revision shape: ${dto.revision}`);
    expectEqual(dto.config, DEFAULT_REMOTE_CONFIG, 'document');
    expectEqual(service().resolve(anon).revision, dto.revision, 'stable revision');
    expectEqual(service().resolve(noDevice).revision, dto.revision, 'no device id, same document');
  });

  await check('resolve: env overrides apply to everyone and change the revision', () => {
    const dto = service({ maintenance: { enabled: true, message: 'Back in 10 minutes' } }).resolve(anon);
    expectEqual(dto.variant, 'default', 'overrides are the baseline, not a variant');
    expectEqual(dto.config.maintenance, { enabled: true, message: 'Back in 10 minutes' }, 'maintenance');
    expectEqual(dto.config.features, DEFAULT_REMOTE_CONFIG.features, 'features untouched');
    expectTrue(dto.revision !== service().resolve(anon).revision, 'revision changed');
  });

  await check('resolve: a bad override fails at construction, naming the path', () => {
    const err = expectThrows(() => service({ features: { publish: false } }), 'typo key');
    expectTrue(/REMOTE_CONFIG_OVERRIDES\.features\.publish: unknown key/.test(String(err)), String(err));
    expectMergeError(() => service({ features: { publishing: 'false' } }), null, 'string for boolean');
  });

  await check('resolve: rules apply only when they match, in order, and show in variant', () => {
    const legacyAndroid: ConfigRule = {
      id: 'legacy-android-renewal-off',
      description: '',
      matches: (ctx) => ctx.platform === 'android' && ctx.appBuild !== null && ctx.appBuild < 100,
      patch: { features: { renewal: false } },
    };
    const tester: ConfigRule = {
      id: 'qa-tester',
      description: '',
      matches: (ctx) => ctx.userId === 'qa-user',
      patch: { features: { renewal: true, stats: false } },
    };
    const bucketed: ConfigRule = {
      id: 'exp-device-bucket',
      description: 'no device id, no experiment',
      matches: (ctx) => ctx.deviceId !== null && ctx.deviceId.startsWith('a'),
      patch: { features: { publishing: false } },
    };
    const svc = service(null, [legacyAndroid, tester, bucketed]);

    expectEqual(svc.resolve(anon).variant, 'default', 'nobody matches');
    expectEqual(svc.resolve(noDevice).variant, 'default', 'bucketed rule ignores a null device');
    const inArm = svc.resolve({ ...anon, deviceId: 'a1b2' });
    expectEqual(inArm.variant, 'default+exp-device-bucket', 'in the arm');
    expectEqual(inArm.config.features.publishing, false, 'arm patch');

    const old = svc.resolve({ ...anon, platform: 'android', appBuild: 42 });
    expectEqual(old.variant, 'default+legacy-android-renewal-off', 'old build');
    expectEqual(old.config.features.renewal, false, 'old build patch');
    expectEqual(
      svc.resolve({ ...anon, platform: 'android', appBuild: 100 }).variant,
      'default',
      'new build',
    );

    const both = svc.resolve({ ...anon, platform: 'android', appBuild: 42, userId: 'qa-user' });
    expectEqual(both.variant, 'default+legacy-android-renewal-off+qa-tester', 'both, in order');
    expectEqual(both.config.features.renewal, true, 'the later rule wins');
    expectEqual(both.config.features.stats, false, 'the later rule applies');
  });

  await check('resolveConfig: exactly the document resolve() serves', () => {
    const rule: ConfigRule = {
      id: 'android-only',
      description: '',
      matches: (ctx) => ctx.platform === 'android',
      patch: { features: { stats: false } },
    };
    const svc = service({ maintenance: { message: 'Back soon' } }, [rule]);
    for (const ctx of [anon, noDevice, { ...anon, platform: 'android' as const }]) {
      expectEqual(svc.resolveConfig(ctx), svc.resolve(ctx).config, `same document for ${ctx.platform}`);
    }
  });

  await check('resolve: duplicate or malformed rule ids are rejected at startup', () => {
    const rule: ConfigRule = { id: 'dup', description: '', matches: () => false, patch: {} };
    expectThrows(() => service(null, [rule, rule]), 'duplicate id');
    expectThrows(() => service(null, [{ ...rule, id: 'Not Valid' }]), 'malformed id');
  });

  await check('resolve: the live RULES registry constructs cleanly', () => {
    expectEqual(typeof service(null, RULES).resolve(anon).revision, 'string', 'revision');
  });

  // ---- the route -----------------------------------------------------------
  const server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  const get = (headers: Record<string, string> = {}) =>
    fetch(`http://127.0.0.1:${port}/api/v1/config`, { headers });

  await check('route: 200 with no headers at all, uncacheable, in the envelope', async () => {
    const reply = await get();
    expectEqual(reply.status, 200, 'status');
    expectEqual(reply.headers.get('cache-control'), 'no-store', 'cache-control');
    const body = (await reply.json()) as {
      success: boolean;
      data: { config: unknown; variant: string };
    };
    expectEqual(body.success, true, 'envelope');
    expectEqual(body.data.variant, 'default', 'variant');
    expectEqual(body.data.config, JSON.parse(JSON.stringify(DEFAULT_REMOTE_CONFIG)), 'document');
  });

  await check('route: identity and build headers are accepted, a bad token never 401s', async () => {
    const withToken = await get({
      authorization: `Bearer ${signAccessToken('00000000-0000-0000-0000-000000000000')}`,
      'x-device-id': 'install-1',
      'x-app-platform': 'android',
      'x-app-version': '1.0.0',
      'x-app-build': '7',
    });
    expectEqual(withToken.status, 200, 'valid token');
    expectEqual((await get({ authorization: 'Bearer not-a-jwt' })).status, 200, 'garbage token');
  });

  server.close();
  report('check-remote-config');
}

void main();
