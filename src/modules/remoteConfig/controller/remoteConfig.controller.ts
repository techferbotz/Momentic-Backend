import type { Request, Response } from 'express';
import { remoteConfigService } from '../service/remoteConfig.service';
import { contextFromRequest } from '../remoteConfig.context';
import { ok } from '../../../utils/respond';

/** GET /config — the app's behaviour switches, resolved for this caller. */
export function getConfig(req: Request, res: Response): void {
  const result = remoteConfigService.resolve(contextFromRequest(req));
  // The answer can differ per caller and change without a deploy, so nothing
  // between the app and us may cache it. The app caches it itself, by ttlSeconds.
  res.setHeader('Cache-Control', 'no-store');
  ok(res, result);
}
