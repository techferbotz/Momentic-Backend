/**
 * Fixtures for the legal pages (HOA protocol 12): each is a full HTML document
 * with the sections the stores expect, quotes the retention constants rather
 * than a retyped number, and is served at its root path and alias. No database.
 *
 *   npm run check:legal
 */
process.env.DATABASE_URL ??= 'postgresql://check:check@localhost:5432/check';
process.env.JWT_SECRET ??= 'check-placeholder-secret-of-at-least-32-chars';
process.env.GOOGLE_CLIENT_ID ??= 'check.apps.googleusercontent.com';
process.env.PUBLIC_WEB_ORIGIN ??= 'https://momentic.ferbotz.com';

import type { AddressInfo } from 'node:net';
import { createApp } from '../app';
import { ACCOUNT, CREATION_LIMITS } from '../config/constants';
import {
  DELETED_ACCOUNT_PURGE_DAYS,
  DELETION_REQUEST_SLA_DAYS,
  LEGAL_APP_NAME,
  LEGAL_COMPANY,
  LEGAL_CONTACT_EMAIL,
  LOG_RETENTION_DAYS,
  renderDeleteAccount,
  renderPrivacyPolicy,
  renderTermsOfService,
} from '../modules/legal/legal.view';
import { DEFAULT_REMOTE_CONFIG } from '../modules/remoteConfig/remoteConfig.defaults';
import { check, expectEqual, expectTrue, report } from './checkUtil';

const flat = (html: string) => html.replace(/\s+/g, ' ');

function expectAll(html: string, phrases: string[], page: string): void {
  const text = flat(html);
  for (const phrase of phrases) expectTrue(text.includes(phrase), `${page} is missing "${phrase}"`);
}

async function main(): Promise<void> {
  const pages = {
    privacy: renderPrivacyPolicy(),
    terms: renderTermsOfService(),
    deleteAccount: renderDeleteAccount(),
  };

  await check('every page is a complete, self-contained document', () => {
    for (const [name, html] of Object.entries(pages)) {
      expectTrue(html.startsWith('<!DOCTYPE html>'), `${name}: doctype`);
      expectTrue(html.includes(LEGAL_APP_NAME), `${name}: names the app`);
      expectTrue(html.includes(`mailto:${LEGAL_CONTACT_EMAIL}`), `${name}: contact address`);
      expectTrue(!/<script|<link /i.test(html), `${name}: no external scripts or stylesheets`);
      expectTrue(!/TODO|\[your/i.test(html), `${name}: an unfilled placeholder reached the page`);
    }
  });

  await check('the privacy policy has the sections the stores expect', () => {
    expectAll(
      pages.privacy,
      [
        'Information We Collect',
        'How We Use Your Information',
        'Who Can See a Moment',
        'How We Share Information',
        'Data Retention',
        'Security',
        'Your Rights',
        'Children',
        'International',
        'Contact Us',
        'RevenueCat',
        'Amazon Web Services',
        'anyone who has its link',
      ],
      'privacy',
    );
  });

  await check('the terms cover payment, content and the rules', () => {
    expectAll(
      pages.terms,
      [
        'Eligibility',
        'one-time purchase',
        'Refunds are handled by the store',
        'consent of the people who appear in your photos',
        'Acceptable Use',
        'Limitation of Liability',
        'Governing Law',
        LEGAL_COMPANY,
      ],
      'terms',
    );
  });

  await check('the deletion page gives both routes and quotes the real windows', () => {
    expectEqual(DELETED_ACCOUNT_PURGE_DAYS, ACCOUNT.deletedRetentionDays, 'purge window is imported');
    expectAll(
      pages.deleteAccount,
      [
        'Delete account',
        'subject=Delete%20my%20account',
        'What is deleted',
        'What is kept',
        `${DELETED_ACCOUNT_PURGE_DAYS} days`,
        `${DELETION_REQUEST_SLA_DAYS} days`,
        `${LOG_RETENTION_DAYS} days`,
      ],
      'delete-account',
    );
    expectAll(
      pages.privacy,
      [
        `${CREATION_LIMITS.abandonedDraftDays} days`,
        `${CREATION_LIMITS.orphanImageGraceHours} hours`,
      ],
      'privacy',
    );
  });

  const server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;

  await check('every path and alias is served as public HTML at the root', async () => {
    for (const path of [
      '/privacy',
      '/privacy-policy',
      '/terms',
      '/terms-of-service',
      '/delete-account',
      '/account-deletion',
    ]) {
      const reply = await fetch(`http://127.0.0.1:${port}${path}`);
      expectEqual(reply.status, 200, `${path} status`);
      expectTrue(
        (reply.headers.get('content-type') ?? '').startsWith('text/html'),
        `${path} content-type`,
      );
    }
  });

  await check('remote config links point at these pages', () => {
    const { links } = DEFAULT_REMOTE_CONFIG;
    expectTrue(links.privacyPolicy.endsWith('/privacy'), links.privacyPolicy);
    expectTrue(links.terms.endsWith('/terms'), links.terms);
    expectTrue(links.deleteAccount.endsWith('/delete-account'), links.deleteAccount);
    expectEqual(links.supportEmail, LEGAL_CONTACT_EMAIL, 'support email');
  });

  server.close();
  report('check-legal');
}

void main();
