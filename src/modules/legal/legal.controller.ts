import type { Request, Response } from 'express';
import { renderDeleteAccount, renderPrivacyPolicy, renderTermsOfService } from './legal.view';

/**
 * Self-contained HTML, rendered from constants with no database, so the pages
 * stay up when everything else is down. Store reviewers open them in a browser
 * with no app installed; the app opens them in an in-app browser.
 */
export function privacyPolicy(_req: Request, res: Response): void {
  res.type('html').send(renderPrivacyPolicy());
}

export function termsOfService(_req: Request, res: Response): void {
  res.type('html').send(renderTermsOfService());
}

/** The Play listing's "Delete account" URL. The call that does the work is DELETE /api/v1/me. */
export function deleteAccount(_req: Request, res: Response): void {
  res.type('html').send(renderDeleteAccount());
}
