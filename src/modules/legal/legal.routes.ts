import { Router } from 'express';
import * as legalController from './legal.controller';
import { LEGAL_PATHS } from './legal.view';

/**
 * HOA protocol 12. Root-mounted, public, outside /api/v1. On this hostname `/`
 * belongs to the web renderer, so nginx routes exactly these six paths here —
 * keep the list in docker/nginx/momentica.conf in step with this one.
 */
export const legalRouter = Router();

legalRouter.get([LEGAL_PATHS.privacy, '/privacy-policy'], legalController.privacyPolicy);
legalRouter.get([LEGAL_PATHS.terms, '/terms-of-service'], legalController.termsOfService);
legalRouter.get([LEGAL_PATHS.deleteAccount, '/account-deletion'], legalController.deleteAccount);
