# Remote config — `GET /api/v1/config`

The document the app reads on every cold start to decide how to behave: which entry points are
on, whether this build must update, whether we are in maintenance, the limits the server
enforces, and where the legal pages live. It lets us change behaviour on every installed app
**without a release**. This is HOA protocol 10 (`G:\My Drive\HOA Protocols\10-remote-config-backend.md`);
the app half is protocol 11.

Code: `src/modules/remoteConfig/`, `src/utils/deepMerge.ts`. Fixtures: `npm run check:config`.

## 1. The endpoint

`GET https://momentic.ferbotz.com/api/v1/config` — under `/api/v1` rather than at the root
because `/` on this hostname belongs to the web renderer (a recorded deviation in `CLAUDE.md`).

**Nothing about the caller is required.** No token, no draft token, no headers. Optional inputs,
used for targeting rules when present and never a reason to fail:

```
X-App-Platform: android        # "android" | "ios" | "web"; anything else → "unknown"
X-App-Version: 1.4.2           # display string, logs only
X-App-Build: 1042              # INTEGER build number — what version rules compare
X-Device-Id: <install uuid>    # the experiment-bucketing key
Authorization: Bearer <jwt>    # signature-checked only; an invalid token is ignored, never a 401
```

Response, in the standard envelope, with `Cache-Control: no-store`:

```json
{ "success": true, "data": {
  "schemaVersion": 1,
  "variant": "default",
  "revision": "a19f30a7181d",
  "ttlSeconds": 3600,
  "config": { "...": "section 2" }
}}
```

`variant` is `"default"` or `"default+<ruleId>+…"`; `revision` is the first 12 hex chars of
`sha256(config)`. The handler is pure and synchronous and never touches the database, so it
answers even when Postgres is down.

## 2. The document, key by key

| Key | Today | Meaning |
| --- | --- | --- |
| `features.googleLogin` | `true` | Show "Continue with Google" |
| `features.publishing` | `true` | Show the paywall and the publish purchase |
| `features.renewal` | `true` | Show "extend this link" |
| `features.stats` | `true` | Show views and RSVPs on a published moment |
| `update.minSupportedBuild` | `0` | Builds below this are hard-blocked. 0 = none |
| `update.recommendedBuild` | `0` | Builds below this get a dismissible nudge. 0 = none |
| `update.androidStoreUrl` / `iosStoreUrl` | `null` | Set once the listings exist |
| `update.message` | `null` | Optional copy for either prompt |
| `maintenance.enabled` / `message` | `false` / `null` | The app shows `message` instead of loading |
| `limits.maxUploadBytes` | `8388608` | from `UPLOAD.maxBytes` |
| `limits.uploadMimeTypes` | jpeg, png, webp, heic, heif | from `UPLOAD.allowedMimeTypes` |
| `limits.uploadsPerHour` | `20` | from `RATE_LIMITS.upload` |
| `limits.maxDrafts` / `maxImages` | `20` / `60` | from `CREATION_LIMITS` |
| `limits.draftPreviewMinutes` | `30` | from `RENDER.draftTokenTtlSeconds` |
| `web.origin` | `https://momentic.ferbotz.com` | from `PUBLIC_WEB_ORIGIN`; resolve template thumbnails against it |
| `links.privacyPolicy` / `terms` / `deleteAccount` | `<web.origin>/privacy` … | protocol 12 pages |
| `links.supportEmail` | `support@ferbotz.com` | from `LEGAL_CONTACT_EMAIL` |

`features`, `update`, `maintenance` and `links` are the universal sections, identical in shape in
every HOA app. `limits` and `web` are Momentic's.

**`features.*` are client-side gates only.** Turning one off hides the entry point; the API keeps
working. Closing an API is a server decision, not a config flag.

**Mirrored numbers are imported, never retyped.** Overriding one in the env changes only what the
app is *told*; the server still enforces the constant. Change limits at the source.

## 3. Changing a value

**For everyone, permanently** — edit `DEFAULT_REMOTE_CONFIG` in `remoteConfig.defaults.ts`, run
`npm run typecheck && npm run check:config`, commit, deploy.

**For everyone, right now, without a deploy** — a JSON patch in the server's `.env`, then recreate
the container (env is read at start; no rebuild):

```bash
# on the box, in the repo checkout — one line, no quotes around the JSON
echo 'REMOTE_CONFIG_OVERRIDES={"maintenance":{"enabled":true,"message":"Back in 10 minutes"}}' >> .env
docker compose -f docker-compose.prod.yml up -d app
curl -s https://momentic.ferbotz.com/api/v1/config | head -c 300
```

The container **refuses to start** on a bad override and names the path
(`REMOTE_CONFIG_OVERRIDES.features.publish: unknown key`) — read `logs --tail=30 app`. To undo,
remove the line and `up -d app` again. This is the emergency switch: it reaches every app within
one restart plus `ttlSeconds`, or at its next cold start.

**For some callers** — add a rule to `RULES` in `remoteConfig.rules.ts`. Rules apply in order, a
later one wins, and each applied id is appended to `variant`. A device-bucketed rule must guard
`ctx.deviceId !== null`. Add a fixture to `check-remote-config.ts` for any rule with logic in
`matches`.

## 4. Rules for the shape

- **Additive-only.** Adding a key is always safe: clients ignore unknown keys and default missing
  ones. Removing or renaming a key breaks old builds — bump `SCHEMA_VERSION`, and prefer adding a
  new key instead.
- **Defaults equal today's behaviour.**
- **Strict merge.** Every override and rule patch must fit the default's shape: an unknown key or a
  wrong type throws at boot. `null` may clear a primitive, never a section.
- **Every change the app can observe is a `BE-nnn` entry** in the contract folder, with `API.md`
  updated.
