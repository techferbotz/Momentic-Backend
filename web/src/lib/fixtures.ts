import { getTemplate } from '@api/templates/registry';
import birthdayGiftReveal from '../fixtures/birthday_gift_reveal.json';
import greetingOpenLetter from '../fixtures/greeting_open_letter.json';
import { manifestFor } from '../templates/manifest';
import type { RouteOutcome } from './route';
import type { RenderMode, RenderPayload } from './types';

export type { RenderMode };

interface Fixture {
  label: string;
  values: Record<string, unknown>;
}

/**
 * Committed states, one per thing worth looking at. Keyed by template id so a
 * seventh template adds a JSON file and one line here.
 */
export const FIXTURES: Record<string, Record<string, Fixture>> = {
  birthday_gift_reveal: birthdayGiftReveal as Record<string, Fixture>,
  greeting_open_letter: greetingOpenLetter as Record<string, Fixture>,
};

/**
 * The link-preview copy the API would send: the registry's `og` strings with
 * `{fieldKey}` filled from the values, falling back to the name and tagline
 * when the placeholders fill to nothing.
 */
function fill(text: string, values: Record<string, unknown>): string {
  return text
    .replace(/\{([^}]+)\}/g, (_match, key: string) => {
      const value = values[key];
      return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
    })
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Builds the same RouteOutcome the real route builds, so a fixture goes through
 * the identical rendering path — modes, caching rules, OG, branding and all.
 * A harness that rendered things its own way would be checking itself, not the
 * product.
 */
export function fixturePayload(
  templateId: string,
  fixtureKey: string,
  mode: RenderMode,
): RouteOutcome | undefined {
  const fixture = FIXTURES[templateId]?.[fixtureKey];
  const manifest = manifestFor(templateId);
  const template = getTemplate(templateId);
  if (!fixture || !manifest || !template) return undefined;

  const expired = mode === 'expired';

  const payload: RenderPayload = {
    templateId,
    // `expired` really does arrive with values null — the harness has to be
    // honest about that or it would not be testing the state that matters.
    values: expired ? null : fixture.values,
    meta: {
      mode,
      expiresAt: mode === 'draft' || expired ? '2026-10-05T00:00:00.000Z' : null,
      showBranding: true,
    },
    og: {
      title: fill(template.og.title, fixture.values) || template.name,
      description: fill(template.og.description, fixture.values) || template.tagline,
      imageUrl: manifest.ogCard,
    },
    features: { rsvp: false },
  } as RenderPayload;

  return {
    state: { kind: 'render', code: `__preview/${templateId}/${fixtureKey}`, payload },
    status: 200,
    cacheControl: 'no-store',
    robots: 'noindex, nofollow',
  };
}
