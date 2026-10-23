import { ACCOUNT, CREATION_LIMITS, RENDER } from '../../config/constants';

/**
 * Legal pages: privacy policy, terms of service, account deletion (HOA protocol 12).
 *
 * The prose describes what this backend actually does: Google sign-in, anonymous
 * drafts before sign-in, photos re-encoded to WebP with metadata stripped and
 * stored on AWS in Mumbai, public-by-link moments, RSVPs from recipients, daily
 * view counts, one-time store purchases verified through RevenueCat, and the
 * cleanup jobs in src/scripts/. Change the data handling and this page in the
 * same commit.
 *
 * What runs only inside the app (crash reporting, analytics, notifications) is
 * not described yet: the app is not built. When the app side reports an SDK it
 * embeds (an APP-nnn request in the contract folder), this page changes first.
 *
 * Starting templates, not legal advice — have them reviewed before the store
 * listing goes live.
 */

// ── Shared across all documents ──
export const LEGAL_APP_NAME = 'Momentic';
// TODO: confirm the exact legal entity that operates the app.
export const LEGAL_COMPANY = 'Ferbotz';
export const LEGAL_CONTACT_EMAIL = 'support@ferbotz.com';

/** Root paths on the web origin. nginx routes exactly these to the API. */
export const LEGAL_PATHS = {
  privacy: '/privacy',
  terms: '/terms',
  deleteAccount: '/delete-account',
} as const;

// ── Per-document; bump on every material change ──
export const PRIVACY_EFFECTIVE_DATE = 'October 23, 2026';
export const TERMS_EFFECTIVE_DATE = 'October 23, 2026';
export const DELETE_ACCOUNT_EFFECTIVE_DATE = 'October 23, 2026';
export const TERMS_GOVERNING_LAW = 'India';

// ── Retention windows quoted on the pages ──
// Public promises: change the operational reality and these together, never one alone.
/** Deadline for actioning an emailed deletion request. In-app deletion is immediate. */
export const DELETION_REQUEST_SLA_DAYS = 30;
/** How long server logs (IP address + request metadata) are kept. */
export const LOG_RETENTION_DAYS = 90;
/** Imported from the modules that enforce them. */
export const DELETED_ACCOUNT_PURGE_DAYS = ACCOUNT.deletedRetentionDays;
export const ABANDONED_DRAFT_DAYS = CREATION_LIMITS.abandonedDraftDays;
export const UNUSED_PHOTO_HOURS = CREATION_LIMITS.orphanImageGraceHours;
export const DRAFT_PREVIEW_MINUTES = RENDER.draftTokenTtlSeconds / 60;

/** Shared HTML shell: self-contained, inline CSS, light theme, readable on a phone. */
function renderLegalPage(title: string, lastUpdated: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} · ${LEGAL_APP_NAME}</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.6;
      color: #2a1f24; background: #ffffff; margin: 0; padding: 40px 20px; }
    main { max-width: 760px; margin: 0 auto; }
    h1 { font-size: 1.9rem; margin: 0 0 4px; }
    h2 { font-size: 1.25rem; margin: 32px 0 8px; }
    .updated { color: #75656c; margin: 0 0 24px; }
    p, li { color: #3d3036; }
    ul, ol { padding-left: 22px; }
    li { margin: 6px 0; }
    a { color: #b03a64; }
    strong { color: #2a1f24; }
    .callout { background: #fdf2f5; border: 1px solid #f5d3de; border-left: 4px solid #d65c86;
      border-radius: 8px; padding: 16px 20px; margin: 16px 0; }
    .callout > :first-child { margin-top: 0; }
    .callout > :last-child { margin-bottom: 0; }
    .warn { background: #fff7ed; border-color: #fed7aa; border-left-color: #ea580c; }
    .steps li { margin: 10px 0; }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p class="updated">Last updated: ${lastUpdated}</p>
    ${body}
  </main>
</body>
</html>`;
}

export function renderPrivacyPolicy(): string {
  const app = LEGAL_APP_NAME;
  const company = LEGAL_COMPANY;
  const email = LEGAL_CONTACT_EMAIL;

  const body = `<p>This Privacy Policy explains how ${company} (&ldquo;we&rdquo;, &ldquo;us&rdquo;)
    collects, uses and shares information when you use the ${app} mobile app and the moment pages
    it publishes (the &ldquo;Service&rdquo;). ${app} lets you personalise a template &mdash; a
    birthday wish, an invitation, a letter &mdash; and share it as a link. This policy covers both
    the people who create moments and the people who open them.</p>

    <h2>1. Information We Collect</h2>
    <p><strong>If you create moments:</strong></p>
    <ul>
      <li><strong>Before you sign in.</strong> You can start creating without an account. The app
        then holds a random token that identifies your device&rsquo;s drafts; we store only a
        one-way hash of it.</li>
      <li><strong>Account information.</strong> When you sign in with Google, we receive your email
        address, name, profile photo and your Google account identifier.</li>
      <li><strong>What you put into a moment.</strong> The template you choose and everything you
        enter: names, messages, dates, event details and places, and colours or options you
        pick.</li>
      <li><strong>Photos.</strong> Photos you add are re-encoded to WebP at two sizes. Embedded
        metadata, including camera details and GPS location, is removed before storage.</li>
      <li><strong>Purchases.</strong> Publishing a moment is a one-time purchase through Google Play
        or the Apple App Store. We receive and keep the transaction record (transaction identifier,
        product, price and currency, purchase time) via RevenueCat. We never receive your card or
        bank details.</li>
    </ul>
    <p><strong>If you open a moment someone shared with you:</strong></p>
    <ul>
      <li><strong>Views.</strong> We count how many times a moment is opened each day. The count is
        a number; it does not record who you are.</li>
      <li><strong>RSVPs.</strong> If you reply to an invitation, we store the name you give, your
        answer, the number of guests, and an optional message and phone number. These are shared
        with the person who sent you the invitation.</li>
    </ul>
    <p><strong>From everyone:</strong> our servers see your IP address. We use it briefly in memory to
    limit abuse, and it is recorded in server logs with the request&rsquo;s time and path.</p>

    <h2>2. How We Use Your Information</h2>
    <ul>
      <li>To build, save, preview and publish your moments, and to show them to the people you share
        them with.</li>
      <li>To show you how your published moments are doing: views and RSVPs.</li>
      <li>To verify purchases and keep track of how long each link stays live.</li>
      <li>To keep the Service secure, prevent abuse and fix problems.</li>
      <li>To respond to you, and to meet legal obligations.</li>
    </ul>
    <p>We do not sell your information, show ads, or use your content to train AI models.</p>

    <h2>3. Who Can See a Moment</h2>
    <p>A published moment is visible to <strong>anyone who has its link</strong>. Links are eight
    random characters and are not listed anywhere; search engines are told not to index them.
    Anyone you send a link to can forward it. When a link is shared in a messaging app, the preview
    shows the moment&rsquo;s title, which usually includes the recipient&rsquo;s name, and its cover
    photo. A draft preview link works for about ${DRAFT_PREVIEW_MINUTES} minutes.</p>
    <p>Photo files are served from addresses that are long, random and not tied to your name or
    account. Anyone who has a photo&rsquo;s address can open it.</p>

    <h2>4. How We Share Information</h2>
    <p>We share information only with service providers that run parts of the Service for us:</p>
    <ul>
      <li><strong>Google</strong> &mdash; sign-in.</li>
      <li><strong>Amazon Web Services</strong> &mdash; hosting, database and photo storage, in the
        Mumbai (India) region.</li>
      <li><strong>RevenueCat, Google Play and the Apple App Store</strong> &mdash; purchases.</li>
    </ul>
    <p>We may also disclose information if the law requires it, to protect people&rsquo;s safety or
    our rights, or as part of a business transfer.</p>

    <h2>5. Data Retention</h2>
    <ul>
      <li>Drafts made without signing in are deleted, with their photos, after
        ${ABANDONED_DRAFT_DAYS} days without activity.</li>
      <li>Photos you upload but never use in a moment are deleted after ${UNUSED_PHOTO_HOURS}
        hours.</li>
      <li>A moment whose paid time has run out stops showing its content, but is kept so you can
        renew it, until you delete it or your account.</li>
      <li>Server logs are kept for up to ${LOG_RETENTION_DAYS} days.</li>
      <li>When you delete your account, your moments go offline immediately and everything is
        permanently erased within ${DELETED_ACCOUNT_PURGE_DAYS} days. The
        <a href="${LEGAL_PATHS.deleteAccount}">Account Deletion</a> page has the details.</li>
    </ul>

    <h2>6. Security</h2>
    <p>All traffic is encrypted in transit. Access to our systems is restricted, and device tokens
    are stored only as one-way hashes. No system is perfectly secure, so we cannot guarantee
    absolute security.</p>

    <h2>7. Your Rights and Choices</h2>
    <p>Depending on where you live, you may have the right to access, correct, delete or export
    your information, or to object to some uses of it. You can delete a moment, or your whole
    account, from inside the app at any time, or ask us by email. If you sent an RSVP and want it
    removed, contact us with the invitation&rsquo;s link. Write to
    <a href="mailto:${email}">${email}</a> for any of these.</p>

    <h2>8. Children&rsquo;s Privacy</h2>
    <p>The Service is not directed to children under 13 (or the minimum age in your country), and
    we do not knowingly collect their personal information. If you believe a child has given us
    information, contact us and we will delete it.</p>

    <h2>9. International Users</h2>
    <p>We store and process information in India. If you use the Service from elsewhere, your
    information is transferred there.</p>

    <h2>10. Changes to This Policy</h2>
    <p>We may update this policy. We will change the &ldquo;Last updated&rdquo; date above and,
    where appropriate, tell you in the app.</p>

    <h2>11. Contact Us</h2>
    <p>Questions about this policy or your data: <a href="mailto:${email}">${email}</a>.</p>`;

  return renderLegalPage(`${app} Privacy Policy`, PRIVACY_EFFECTIVE_DATE, body);
}

export function renderTermsOfService(): string {
  const app = LEGAL_APP_NAME;
  const company = LEGAL_COMPANY;
  const email = LEGAL_CONTACT_EMAIL;

  const body = `<p>These Terms of Service (&ldquo;Terms&rdquo;) are an agreement between you and
    ${company} (&ldquo;we&rdquo;, &ldquo;us&rdquo;) about your use of the ${app} app and the moment
    pages it publishes (the &ldquo;Service&rdquo;). By using the Service you agree to these Terms.
    If you do not agree, do not use it.</p>

    <h2>1. Eligibility</h2>
    <p>You must be at least 13 years old, or the minimum age of digital consent in your country, to
    create moments. Anyone can open a moment that was shared with them.</p>

    <h2>2. The Service</h2>
    <p>${app} lets you personalise ready-made templates with your own words and photos and share
    the result as a link. Templates, features and prices may change over time.</p>

    <h2>3. Your Account</h2>
    <p>You can start without an account; signing in with Google is needed to publish. Drafts made
    before you sign in are tied to your device and can be lost if you uninstall the app before
    signing in. You are responsible for activity under your account.</p>

    <h2>4. Licence to Use the App</h2>
    <p>We grant you a limited, personal, non-exclusive, non-transferable, revocable licence to use
    the Service as these Terms allow.</p>

    <h2>5. Publishing, Payment and Refunds</h2>
    <ul>
      <li>Publishing a moment is a <strong>one-time purchase</strong> that keeps its link live for
        the number of days you choose. It is not a subscription and does not renew by itself.</li>
      <li>When the time runs out, the link shows that the moment has ended. You can extend it with
        another purchase; the link stays the same.</li>
      <li>Purchases are made through Google Play or the Apple App Store and are subject to their
        terms. Refunds are handled by the store under its own policy. Deleting a moment or your
        account before its time runs out does not entitle you to a refund.</li>
    </ul>

    <h2>6. Your Content</h2>
    <p>You keep ownership of the words and photos you add (&ldquo;your content&rdquo;). You give us
    a licence to store, process and display your content only to provide the Service, including
    showing it to anyone who opens your link. <strong>You confirm you have the right to use
    everything you add, including the consent of the people who appear in your photos or whose
    names and details you include.</strong></p>

    <h2>7. Acceptable Use</h2>
    <p>You agree not to use the Service to:</p>
    <ul>
      <li>share photos or details of people without their consent, or impersonate anyone;</li>
      <li>create content that is unlawful, sexual content involving minors, harassing, hateful,
        threatening, defamatory or deceptive;</li>
      <li>infringe intellectual property, privacy or publicity rights;</li>
      <li>scrape, overload, reverse engineer, or get around the limits of the Service; or</li>
      <li>break any law.</li>
    </ul>
    <p>We may take down moments or suspend accounts that break these Terms.</p>

    <h2>8. Intellectual Property</h2>
    <p>The Service &mdash; the app, the templates, their designs, animations and branding &mdash; is
    owned by us or our licensors. These Terms give you no rights in it beyond the licence above.</p>

    <h2>9. Third-Party Services</h2>
    <p>The Service relies on others, including Google, Apple, RevenueCat and Amazon Web Services.
    Your use of their services is subject to their terms, and we are not responsible for them.</p>

    <h2>10. Termination</h2>
    <p>You can stop using the Service and delete your account at any time. We may suspend or end
    your access if you break these Terms or to protect the Service or others.</p>

    <h2>11. Disclaimers</h2>
    <p>The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without
    warranties of any kind, to the fullest extent the law allows. We do not promise that a link
    will be reachable at every moment.</p>

    <h2>12. Limitation of Liability</h2>
    <p>To the extent the law allows, ${company} is not liable for indirect, incidental, special,
    consequential or punitive damages, or for loss of data, profits or goodwill. Our total liability
    for any claim about the Service is limited to what you paid us in the 12 months before the
    claim.</p>

    <h2>13. Indemnity</h2>
    <p>You agree to indemnify ${company} against claims and costs arising from your content, your
    use of the Service, or your breach of these Terms or anyone&rsquo;s rights.</p>

    <h2>14. Governing Law</h2>
    <p>These Terms are governed by the laws of ${TERMS_GOVERNING_LAW}, and the courts there have
    exclusive jurisdiction, except where the law of your country says otherwise.</p>

    <h2>15. Changes to These Terms</h2>
    <p>We may update these Terms. We will change the &ldquo;Last updated&rdquo; date above and,
    where appropriate, tell you in the app. Continuing to use the Service means you accept the
    change.</p>

    <h2>16. Contact Us</h2>
    <p>Questions about these Terms: <a href="mailto:${email}">${email}</a>.</p>`;

  return renderLegalPage(`${app} Terms of Service`, TERMS_EFFECTIVE_DATE, body);
}

/**
 * The "Delete account" URL for the Google Play listing. Play requires it to name
 * the app and developer as listed, put the steps first, work for someone without
 * the app, and say what is deleted, what is kept and for how long.
 *
 * The in-app route is DELETE /api/v1/me (authService.deleteAccount →
 * userRepo.softDelete): the account and its moments go offline at once and the
 * links are released; purge-deleted-users hard-deletes everything, photo files
 * included, after DELETED_ACCOUNT_PURGE_DAYS. Signing back in within that window
 * restores the account but not its moments.
 */
export function renderDeleteAccount(): string {
  const app = LEGAL_APP_NAME;
  const company = LEGAL_COMPANY;
  const email = LEGAL_CONTACT_EMAIL;

  // TODO(app): the in-app steps must name the screens the shipped app has —
  // reviewers follow them literally. Confirm once the app's settings screen exists.

  const body = `<p>This page explains how to delete your <strong>${app}</strong> account and the
    data that goes with it. ${app} is published by <strong>${company}</strong>.</p>

    <h2>Option 1 &mdash; Delete your account in the app</h2>
    <div class="callout">
      <ol class="steps">
        <li>Open <strong>${app}</strong> and make sure you are signed in to the account you want to
          delete.</li>
        <li>Open <strong>Settings</strong>.</li>
        <li>Tap <strong>Delete account</strong> and confirm.</li>
      </ol>
    </div>
    <p>Your account is closed immediately and every moment you published stops working at
    once.</p>

    <h2>Option 2 &mdash; Ask us by email</h2>
    <p>Use this if you no longer have the app or cannot sign in.</p>
    <div class="callout">
      <ol class="steps">
        <li>Email <a href="mailto:${email}?subject=Delete%20my%20account">${email}</a> from the
          Google account email you used with ${app}.</li>
        <li>Use the subject line <strong>Delete my account</strong>.</li>
        <li>Reply to our confirmation email if we send one, so we can check the account is
          yours.</li>
      </ol>
    </div>
    <p>We complete verified requests within <strong>${DELETION_REQUEST_SLA_DAYS} days</strong>.</p>

    <h2>What is deleted</h2>
    <ul>
      <li><strong>Your account</strong> &mdash; email address, name, profile photo and the Google
        identifier linked to it.</li>
      <li><strong>Every moment you made</strong>, published or draft, with everything you wrote in
        it. Published links stop working immediately.</li>
      <li><strong>Every photo you uploaded</strong>, including the stored files.</li>
      <li><strong>RSVPs and view counts</strong> for your moments.</li>
      <li><strong>Your purchase records</strong> held by ${app}.</li>
    </ul>
    <p>Your account and moments disappear from the Service immediately. The underlying data is
    permanently erased within <strong>${DELETED_ACCOUNT_PURGE_DAYS} days</strong>. If you sign in
    again with the same Google account during that time, your account comes back but your moments
    do not.</p>

    <h2>What is kept, and for how long</h2>
    <ul>
      <li><strong>Server logs</strong> (up to <strong>${LOG_RETENTION_DAYS} days</strong>) &mdash;
        IP addresses and request details used to run and secure the Service.</li>
      <li><strong>Purchase records held by Google Play, the Apple App Store and RevenueCat</strong>,
        under their own policies.</li>
    </ul>
    <p>Copies outside our control are unaffected: screenshots, photos saved by the people you
    shared with, and link previews already stored by messaging apps.</p>

    <div class="callout warn">
      <p>Publishing is a one-time purchase, not a subscription, so there is nothing to cancel in
      the store. Time remaining on a published link is not refunded when you delete your
      account.</p>
    </div>

    <h2>Questions</h2>
    <p>Contact us at <a href="mailto:${email}">${email}</a>. See also our
    <a href="${LEGAL_PATHS.privacy}">Privacy Policy</a> and
    <a href="${LEGAL_PATHS.terms}">Terms of Service</a>.</p>`;

  return renderLegalPage(`Delete your ${app} account`, DELETE_ACCOUNT_EFFECTIVE_DATE, body);
}
