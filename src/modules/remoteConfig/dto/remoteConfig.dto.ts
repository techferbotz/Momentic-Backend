import type { DeepPartial } from '../../../utils/deepMerge';

/**
 * The remote config document — what the app reads at launch to decide how to
 * behave (HOA protocol 10). Served by GET /api/v1/config.
 *
 * Rules for this shape, which are what let it evolve without an app release:
 *   - Every value is a JSON primitive, a nested object of them, or an array. No
 *     dates (ISO strings), no undefined (null means "not set").
 *   - ADDING a key is always safe: clients ignore keys they don't know and use a
 *     compiled-in default for keys that are missing. REMOVING or RENAMING one
 *     breaks old builds — bump SCHEMA_VERSION and prefer adding a new key.
 *   - Defaults equal today's behaviour, so an app that starts honouring the
 *     config changes nothing until a value is deliberately flipped.
 *
 * `features`, `update`, `maintenance` and `links` are universal — identical in
 * every HOA app, so the shared client code can rely on them. `limits` and `web`
 * are Momentic's own.
 */
export interface RemoteConfig {
  /**
   * Kill switches for app entry points. `false` hides the entry point; the API
   * route behind it keeps working — closing an API is a server decision.
   */
  features: {
    /** The "Continue with Google" entry point. */
    googleLogin: boolean;
    /** The paywall and the publish purchase for a draft. */
    publishing: boolean;
    /** "Extend this link" on a published or expired moment. */
    renewal: boolean;
    /** The views and RSVP readouts on a published moment. */
    stats: boolean;
  };
  /**
   * Update policy. The app compares its INTEGER build number (what it sends as
   * X-App-Build), never the display version. 0 = no requirement.
   */
  update: {
    /** Below this: hard block, "update to continue". */
    minSupportedBuild: number;
    /** Below this: a dismissible "update available" nudge. */
    recommendedBuild: number;
    androidStoreUrl: string | null;
    iosStoreUrl: string | null;
    message: string | null;
  };
  /** Emergency switch: the app shows `message` instead of loading. */
  maintenance: {
    enabled: boolean;
    message: string | null;
  };
  /**
   * Limits the server enforces, for pre-flight checks and copy. Mirrored from
   * the enforcing constants, never retyped (remoteConfig.defaults.ts).
   */
  limits: {
    maxUploadBytes: number;
    uploadMimeTypes: string[];
    uploadsPerHour: number;
    maxDrafts: number;
    maxImages: number;
    draftPreviewMinutes: number;
  };
  /** Where the web half lives: template thumbnails and preview paths resolve against it. */
  web: {
    origin: string;
  };
  /** Absolute URLs (HOA protocol 12), so the app never hard-codes them. */
  links: {
    privacyPolicy: string;
    terms: string;
    deleteAccount: string;
    supportEmail: string;
  };
}

/** What GET /config returns inside the envelope's `data`. */
export interface RemoteConfigDto {
  /** Bumped only when a key is removed or renamed. */
  schemaVersion: number;
  /** "default", or "default+<ruleId>+…" for every targeting rule that applied. */
  variant: string;
  /** First 12 hex chars of sha256(config) — changes whenever any value does. */
  revision: string;
  /** Re-fetch after this many seconds (and on every cold start). */
  ttlSeconds: number;
  config: RemoteConfig;
}

export type Platform = 'android' | 'ios' | 'web' | 'unknown';

/**
 * Who is asking — the targeting input for rules. Every field is optional on the
 * wire; a caller that sends nothing still gets the default document.
 */
export interface ConfigContext {
  /** X-Device-Id: the app's per-install id. null = cannot be bucketed. */
  deviceId: string | null;
  userId: string | null;
  platform: Platform;
  /** Display version, e.g. "1.4.2" — for logs and rules that need it. */
  appVersion: string | null;
  /** Integer build number — what version rules compare. */
  appBuild: number | null;
}

/**
 * When `matches(ctx)` is true, `patch` is deep-merged over the config. Rules
 * apply in registry order; a later rule wins on a conflict.
 */
export interface ConfigRule {
  /** Short, stable, [a-z0-9-]; lands in `variant` and so in analytics. */
  id: string;
  description: string;
  matches: (ctx: ConfigContext) => boolean;
  patch: DeepPartial<RemoteConfig>;
}
