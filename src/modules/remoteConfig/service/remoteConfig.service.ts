import crypto from 'node:crypto';
import { env } from '../../../config/env';
import { deepMergeStrict } from '../../../utils/deepMerge';
import type {
  ConfigContext,
  ConfigRule,
  RemoteConfig,
  RemoteConfigDto,
} from '../dto/remoteConfig.dto';
import { DEFAULT_REMOTE_CONFIG, SCHEMA_VERSION, TTL_SECONDS } from '../remoteConfig.defaults';
import { RULES } from '../remoteConfig.rules';

/** The three layers, least to most specific; the most specific wins on a conflict. */
export interface RemoteConfigLayers {
  defaults: RemoteConfig;
  /** REMOTE_CONFIG_OVERRIDES: a patch applied for EVERY caller. null = none. */
  overrides: Record<string, unknown> | null;
  /** Targeting rules, applied in order. */
  rules: ConfigRule[];
}

/**
 * Resolves the config for one caller. Pure and synchronous on purpose — no
 * database, no await — because it runs on every app launch and must answer
 * even when Postgres is down.
 */
export class RemoteConfigService {
  /** defaults + env overrides, computed once. */
  private readonly base: RemoteConfig;

  constructor(private readonly layers: RemoteConfigLayers) {
    // Validated at construction (= process start), so a bad override fails the
    // boot loudly, naming its path, instead of failing every request quietly.
    this.base =
      layers.overrides === null
        ? layers.defaults
        : deepMergeStrict(layers.defaults, layers.overrides, 'REMOTE_CONFIG_OVERRIDES');

    const seen = new Set<string>();
    for (const rule of layers.rules) {
      if (!/^[a-z0-9-]+$/.test(rule.id) || seen.has(rule.id)) {
        throw new Error(`Remote config rule id "${rule.id}" must be unique and [a-z0-9-]`);
      }
      seen.add(rule.id);
      deepMergeStrict(this.base, rule.patch, `rule:${rule.id}`);
    }
  }

  resolve(ctx: ConfigContext): RemoteConfigDto {
    const { config, applied } = this.resolveWithRules(ctx);
    return {
      schemaVersion: SCHEMA_VERSION,
      variant: ['default', ...applied].join('+'),
      revision: fingerprint(config),
      ttlSeconds: TTL_SECONDS,
      config,
    };
  }

  /**
   * The same resolved document without the envelope, for server code that must
   * OBEY a value rather than report it — so the switch and the behaviour can
   * never disagree.
   */
  resolveConfig(ctx: ConfigContext): RemoteConfig {
    return this.resolveWithRules(ctx).config;
  }

  private resolveWithRules(ctx: ConfigContext): { config: RemoteConfig; applied: string[] } {
    let config = this.base;
    const applied: string[] = [];
    for (const rule of this.layers.rules) {
      if (rule.matches(ctx)) {
        config = deepMergeStrict(config, rule.patch, `rule:${rule.id}`);
        applied.push(rule.id);
      }
    }
    return { config, applied };
  }
}

/** Key order is deterministic: every layer keeps the defaults' own key order. */
function fingerprint(config: RemoteConfig): string {
  return crypto.createHash('sha256').update(JSON.stringify(config)).digest('hex').slice(0, 12);
}

export const remoteConfigService = new RemoteConfigService({
  defaults: DEFAULT_REMOTE_CONFIG,
  overrides: env.remoteConfigOverrides,
  rules: RULES,
});
