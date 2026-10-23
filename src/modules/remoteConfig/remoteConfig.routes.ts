import { Router } from 'express';
import { optionalAuth } from '../../middleware/principal';
import { getConfig } from './controller/remoteConfig.controller';

/**
 * GET /api/v1/config (HOA protocol 10). Everything about the caller is optional:
 * a first launch, a rejected token or an old build sending no headers all get
 * the default document. A token is still read when present — the user id is a
 * targeting input for future rules — but never demanded and never 401s here.
 *
 * Mounted under /api/v1 rather than at the root because on this hostname `/`
 * belongs to the web renderer; the app's base URL is /api/v1/, so the shared
 * client's relative `GET config` lands here unchanged.
 */
export const remoteConfigRouter = Router();

remoteConfigRouter.get('/config', optionalAuth, getConfig);
