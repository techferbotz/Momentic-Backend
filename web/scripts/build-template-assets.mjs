#!/usr/bin/env node
/**
 * Renders the static stills each template needs, from SVG, with sharp.
 *
 *   node scripts/build-template-assets.mjs                        everything
 *   node scripts/build-template-assets.mjs birthday_gift_reveal   one template
 *
 * Naming templates rebuilds only their stills and sample photos and leaves the
 * shared files (fixture photo, favicons) alone, so adding a template does not
 * rewrite every other template's committed images.
 *
 * Three assets per template, each with a different consumer and therefore a
 * different format and shape:
 *
 *   thumb.webp  the mobile app's feed card. WebP — the app decodes it natively
 *               and it is the smallest of the three.
 *   p1.webp     the app's template detail carousel. Phone-shaped.
 *   og.jpg      the link-preview card. JPEG at 1200x630, deliberately NOT WebP:
 *               WhatsApp's preview crawler has never handled WebP dependably,
 *               and link previews are most of this product's distribution.
 *
 * Deliberately no text in any of them. WhatsApp already renders og:title and
 * og:description as text beside the image, so words in the image would only
 * duplicate them — and SVG text rendering through sharp depends on whichever
 * fonts the machine happens to have, which is not a thing to leave to chance in
 * a committed asset.
 *
 * A template whose sample data carries photos also gets those drawn here, into
 * public/samples/ at the paths the backend registry names. They are what a
 * creator sees in the shopfront before choosing a single photo of their own.
 *
 * sharp resolves from the repo root's node_modules (the backend's). This is an
 * authoring step whose output is committed; it is not part of the web build,
 * which is why the renderer's image never needs sharp.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const OUT_ROOT = fileURLToPath(new URL('../public/templates', import.meta.url));

/** The letter's "thank you" palette, matching the template's own tokens. */
const P = {
  stageTop: '#f9e6e9',
  stageBottom: '#eabfca',
  paper: '#fdf8f1',
  paperLit: '#fffefb',
  paperShade: '#efe3d2',
  // The envelope's inside wall, visible either side of the risen sheet. Kept
  // close to the pocket so it reads as depth rather than as two stuck-on tabs.
  paperBack: '#f7eee1',
  edge: '#d9c9b4',
  accent: '#b0455f',
  accentDeep: '#8a2f47',
  ink: '#4a3a30',
};

/**
 * A sealed envelope: body, flap folded down over it, wax at the flap's point.
 *
 * The flap needs its own edge stroke. Cream on cream is invisible otherwise —
 * the first version of this drew a flap nobody could see.
 */
function sealed({ cx, cy, w }) {
  const h = w * (2 / 3);
  const x = cx - w / 2;
  const y = cy - h / 2;
  const r = w * 0.024;
  // Where the flap's point lands, and therefore where the wax goes.
  const apex = y + h * 0.6;

  return `
  <g filter="url(#soft)">
    <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${r.toFixed(1)}" fill="${P.paper}"/>
    <path d="M ${x.toFixed(1)} ${(y + r).toFixed(1)}
             Q ${x.toFixed(1)} ${y.toFixed(1)} ${(x + r).toFixed(1)} ${y.toFixed(1)}
             L ${(x + w - r).toFixed(1)} ${y.toFixed(1)}
             Q ${(x + w).toFixed(1)} ${y.toFixed(1)} ${(x + w).toFixed(1)} ${(y + r).toFixed(1)}
             L ${cx.toFixed(1)} ${apex.toFixed(1)} Z"
          fill="url(#flap)" stroke="${P.edge}" stroke-width="${(w * 0.0035).toFixed(2)}" stroke-opacity="0.75"/>
    <circle cx="${cx.toFixed(1)}" cy="${apex.toFixed(1)}" r="${(w * 0.075).toFixed(1)}" fill="url(#wax)"/>
    <circle cx="${cx.toFixed(1)}" cy="${apex.toFixed(1)}" r="${(w * 0.046).toFixed(1)}" fill="none" stroke="#ffffff" stroke-opacity="0.2" stroke-width="${(w * 0.006).toFixed(2)}"/>
  </g>`;
}

/**
 * An opened envelope with the letter risen out of it.
 *
 * Layering is the whole trick, and getting it wrong is what made the first
 * attempt unreadable: the envelope's BACK and flap go down first, then the
 * sheet on top of them, then the envelope's FRONT pocket over the sheet's
 * bottom edge so the letter genuinely looks tucked inside rather than pasted on.
 */
function opened({ cx, cy, w, seed = 0 }) {
  const h = w * (2 / 3);
  const x = cx - w / 2;
  const y = cy - h / 2;
  const r = w * 0.024;

  const sheetW = w * 0.78;
  const sheetH = h * 1.55;
  const sheetX = cx - sheetW / 2;
  // Bottom of the sheet sits inside the pocket; the rest rises clear.
  const pocketTop = y + h * 0.42;
  const sheetY = pocketTop + h * 0.2 - sheetH;

  // Abstracted writing: varied line lengths so it reads as prose rather than a
  // placeholder block, with a short final line the way a paragraph really ends.
  const lines = [];
  const lineCount = 9;
  const top = sheetY + sheetH * 0.26;
  const gap = sheetH * 0.058;
  for (let i = 0; i < lineCount; i += 1) {
    const isLast = i === lineCount - 1;
    const frac = isLast ? 0.34 : 0.68 + (((i * 41 + seed * 17) % 30) / 100);
    lines.push(
      `<rect x="${(sheetX + sheetW * 0.13).toFixed(1)}" y="${(top + i * gap).toFixed(1)}" ` +
        `width="${(sheetW * 0.74 * frac).toFixed(1)}" height="${(sheetH * 0.0125).toFixed(1)}" ` +
        `rx="${(sheetH * 0.00625).toFixed(1)}" fill="${P.ink}" opacity="${isLast ? 0.18 : 0.24}"/>`,
    );
  }

  return `
  <g filter="url(#soft)">
    <!-- back panel + flap folded open behind -->
    <path d="M ${x.toFixed(1)} ${(y + h * 0.1).toFixed(1)} L ${cx.toFixed(1)} ${(y - h * 0.34).toFixed(1)} L ${(x + w).toFixed(1)} ${(y + h * 0.1).toFixed(1)} Z"
          fill="${P.paperShade}" stroke="${P.edge}" stroke-width="${(w * 0.003).toFixed(2)}" stroke-opacity="0.6"/>
    <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${r.toFixed(1)}" fill="${P.paperBack}"/>
  </g>

  <!-- the letter itself, in front of the envelope's back -->
  <g filter="url(#sheetShadow)">
    <rect x="${sheetX.toFixed(1)}" y="${sheetY.toFixed(1)}" width="${sheetW.toFixed(1)}" height="${sheetH.toFixed(1)}" rx="${(w * 0.012).toFixed(1)}" fill="${P.paperLit}"/>
    <rect x="${(sheetX + sheetW * 0.13).toFixed(1)}" y="${(sheetY + sheetH * 0.15).toFixed(1)}" width="${(sheetW * 0.26).toFixed(1)}" height="${(sheetH * 0.017).toFixed(1)}" rx="${(sheetH * 0.0085).toFixed(1)}" fill="${P.accent}" opacity="0.6"/>
    ${lines.join('\n    ')}
  </g>

  <!-- front pocket, over the sheet's bottom so the letter sits INSIDE -->
  <path d="M ${x.toFixed(1)} ${pocketTop.toFixed(1)}
           L ${(x + w).toFixed(1)} ${pocketTop.toFixed(1)}
           L ${(x + w).toFixed(1)} ${(y + h - r).toFixed(1)}
           Q ${(x + w).toFixed(1)} ${(y + h).toFixed(1)} ${(x + w - r).toFixed(1)} ${(y + h).toFixed(1)}
           L ${(x + r).toFixed(1)} ${(y + h).toFixed(1)}
           Q ${x.toFixed(1)} ${(y + h).toFixed(1)} ${x.toFixed(1)} ${(y + h - r).toFixed(1)} Z"
        fill="url(#pocket)"/>
  <path d="M ${x.toFixed(1)} ${pocketTop.toFixed(1)} L ${cx.toFixed(1)} ${(pocketTop + h * 0.33).toFixed(1)} L ${(x + w).toFixed(1)} ${pocketTop.toFixed(1)}"
        fill="none" stroke="${P.edge}" stroke-width="${(w * 0.003).toFixed(2)}" stroke-opacity="0.5"/>`;
}

function letterScene({ width, height, open, envScale, cyFrac = 0.5, seed = 0 }) {
  const w = width * envScale;
  const cx = width / 2;
  const cy = height * cyFrac;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0.1" y1="0" x2="0.4" y2="1">
      <stop offset="0%" stop-color="${P.stageTop}"/>
      <stop offset="100%" stop-color="${P.stageBottom}"/>
    </linearGradient>
    <linearGradient id="flap" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${P.paperLit}"/>
      <stop offset="100%" stop-color="${P.paperShade}"/>
    </linearGradient>
    <linearGradient id="pocket" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${P.paperLit}"/>
      <stop offset="100%" stop-color="${P.paper}"/>
    </linearGradient>
    <radialGradient id="wax" cx="0.34" cy="0.28" r="0.8">
      <stop offset="0%" stop-color="#c85570"/>
      <stop offset="60%" stop-color="${P.accent}"/>
      <stop offset="100%" stop-color="${P.accentDeep}"/>
    </radialGradient>
    <filter id="soft" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="${(height * 0.008).toFixed(1)}" stdDeviation="${(height * 0.013).toFixed(1)}" flood-color="#3c282d" flood-opacity="0.18"/>
    </filter>
    <filter id="sheetShadow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="${(height * 0.004).toFixed(1)}" stdDeviation="${(height * 0.009).toFixed(1)}" flood-color="#3c282d" flood-opacity="0.14"/>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  ${open ? opened({ cx, cy, w, seed }) : sealed({ cx, cy, w })}
</svg>`;
}

/* ---- Open the Surprise (birthday_gift_reveal) ---------------------------- */

/**
 * The gift in its default blush. Every path below is copied from the
 * template's own inline SVG (viewBox "20 26 260 264"), so the feed card shows
 * the box the recipient will actually tap. Change one, change the other.
 */
const G = {
  stageTop: '#fbe8ec',
  stageBottom: '#f0c6d1',
  wrap: '#fffaf5',
  dot: '#d1607b',
  mouth: '#ffe9dc',
  ribbon: '#d4677f',
  ribbonDeep: '#a9405a',
  edge: '#82283e',
  tag: '#ead7b7',
  tagInk: '#4a3626',
  floor: '#784650',
  glow: '#fff4e4',
  spark: '#d4677f',
  confetti: ['#d4677f', '#f3b6c4', '#f6d58e', '#ffffff', '#9fd3c7', '#a9405a'],
};

/** Seeded, so a re-run writes identical files rather than churning them. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rand, list) => list[Math.floor(rand() * list.length)];
const f1 = (n) => n.toFixed(1);

const RIBBON_EDGE = `stroke="${G.edge}" stroke-opacity="0.35" stroke-width="1.2" stroke-linejoin="round"`;
const SPARK_PATH = 'M10 0C11 7 13 9 20 10 13 11 11 13 10 20 9 13 7 11 0 10 7 9 9 7 10 0Z';

function giftDefs() {
  return `
    <pattern id="g-dots" width="18" height="18" patternUnits="userSpaceOnUse">
      <circle cx="4.5" cy="4.5" r="2.2" fill="${G.dot}" fill-opacity="0.16"/>
      <circle cx="13.5" cy="13.5" r="2.2" fill="${G.dot}" fill-opacity="0.16"/>
    </pattern>
    <linearGradient id="g-side" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0.3"/>
      <stop offset="0.45" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.1"/>
    </linearGradient>
    <linearGradient id="g-top" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.5"/>
      <stop offset="0.55" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.07"/>
    </linearGradient>
    <linearGradient id="g-fall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0.16"/>
      <stop offset="1" stop-color="#000" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="g-glow">
      <stop offset="0" stop-color="${G.glow}" stop-opacity="0.95"/>
      <stop offset="0.62" stop-color="${G.glow}" stop-opacity="0"/>
    </radialGradient>
    <filter id="g-floor" x="-20%" y="-200%" width="140%" height="500%">
      <feGaussianBlur stdDeviation="5"/>
    </filter>
    <filter id="g-lift" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="4" stdDeviation="3.5" flood-color="#3c1e28" flood-opacity="0.2"/>
    </filter>
    <filter id="g-print" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#3c1e28" flood-opacity="0.22"/>
    </filter>`;
}

function giftBody({ open }) {
  return `
    <ellipse cx="150" cy="281" rx="112" ry="8" fill="${G.floor}" fill-opacity="0.22" filter="url(#g-floor)"/>
    <path d="M52 134 L60 125 H240 L248 134 Z" fill="${G.mouth}"/>
    <rect x="46" y="134" width="208" height="146" rx="8" fill="${G.wrap}"/>
    <rect x="46" y="134" width="208" height="146" rx="8" fill="url(#g-dots)"/>
    <rect x="135" y="134" width="30" height="146" fill="${G.ribbon}"/>
    <rect x="140" y="134" width="6" height="146" fill="#fff" fill-opacity="0.2"/>
    <path d="M135.5 134v146M164.5 134v146" stroke="${G.edge}" stroke-opacity="0.35" stroke-width="1" fill="none"/>
    <rect x="46" y="134" width="208" height="146" rx="8" fill="url(#g-side)"/>
    ${open ? '' : '<rect x="46" y="144" width="208" height="14" fill="url(#g-fall)"/>'}`;
}

function giftLid() {
  return `
    <rect x="36" y="104" width="228" height="40" rx="7" fill="${G.wrap}"/>
    <rect x="36" y="104" width="228" height="40" rx="7" fill="url(#g-dots)"/>
    <rect x="135" y="104" width="30" height="40" fill="${G.ribbon}"/>
    <rect x="140" y="104" width="6" height="40" fill="#fff" fill-opacity="0.2"/>
    <path d="M135.5 104v40M164.5 104v40" stroke="${G.edge}" stroke-opacity="0.35" stroke-width="1" fill="none"/>
    <rect x="36" y="104" width="228" height="40" rx="7" fill="url(#g-top)"/>
    <path d="M146 102 L117 152 L127 147 L131 158 L156 106 Z" fill="${G.ribbon}" ${RIBBON_EDGE}/>
    <path d="M154 102 L183 152 L173 147 L169 158 L144 106 Z" fill="${G.ribbon}" ${RIBBON_EDGE}/>
    <path d="M150 100 C 133 72, 94 58, 88 82 C 84 100, 122 108, 150 100 Z" fill="${G.ribbon}" ${RIBBON_EDGE}/>
    <path d="M150 100 C 137 84, 108 74, 104 86 C 101 96, 126 102, 150 100 Z" fill="${G.ribbonDeep}" fill-opacity="0.55"/>
    <path d="M150 100 C 167 72, 206 58, 212 82 C 216 100, 178 108, 150 100 Z" fill="${G.ribbon}" ${RIBBON_EDGE}/>
    <path d="M150 100 C 163 84, 192 74, 196 86 C 199 96, 174 102, 150 100 Z" fill="${G.ribbonDeep}" fill-opacity="0.55"/>
    <rect x="139" y="89" width="22" height="19" rx="7" fill="${G.ribbon}" ${RIBBON_EDGE}/>
    <rect x="143" y="92" width="8" height="5" rx="2.5" fill="#fff" fill-opacity="0.2"/>`;
}

/** Blank on purpose: the page writes the recipient's name here, and a still has none to write. */
function giftTag() {
  return `
    <path d="M150 107 C 146 124, 154 140, 150 158" fill="none" stroke="${G.ribbonDeep}" stroke-width="1.4" stroke-linecap="round"/>
    <g transform="rotate(-4 150 158)" filter="url(#g-lift)">
      <path d="M118 148 H182 L194 160 V210 H106 V160 Z" fill="${G.tag}"/>
      <circle cx="150" cy="158" r="3.6" fill="${G.tagInk}" fill-opacity="0.22"/>
      <path d="M150 148 V158" stroke="${G.ribbonDeep}" stroke-width="1.4"/>
      <rect x="138" y="170" width="24" height="3" rx="1.5" fill="${G.tagInk}" fill-opacity="0.3"/>
      <rect x="122" y="183" width="56" height="7" rx="3.5" fill="${G.tagInk}" fill-opacity="0.4"/>
    </g>`;
}

function confettiPiece(rand, x, y, size) {
  const color = pick(rand, G.confetti);
  if (rand() < 0.22) {
    return `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(size * 0.32)}" fill="${color}"/>`;
  }
  const w = size * 0.6;
  // Foreshortened along its length, the way a tumbling piece catches the light.
  const h = size * (0.45 + rand() * 0.55);
  return `<rect x="${f1(x - w / 2)}" y="${f1(y - h / 2)}" width="${f1(w)}" height="${f1(h)}" rx="${f1(w * 0.12)}" fill="${color}" transform="rotate(${Math.round(rand() * 360)} ${f1(x)} ${f1(y)})"/>`;
}

/** A print tumbling out of the open box, showing one of the sample photos. */
function flyingPrint({ x, y, w, angle, photo }) {
  const pad = w * 0.06;
  const iw = w - pad * 2;
  const ih = iw * 1.25;
  const h = pad + ih + w * 0.2;
  const x0 = x - w / 2;
  const y0 = y - h / 2;
  return `<g transform="rotate(${angle} ${f1(x)} ${f1(y)})" filter="url(#g-print)">
    <rect x="${f1(x0)}" y="${f1(y0)}" width="${f1(w)}" height="${f1(h)}" rx="${f1(w * 0.012)}" fill="#ffffff"/>
    ${photo(`x="${f1(x0 + pad)}" y="${f1(y0 + pad)}" width="${f1(iw)}" height="${f1(ih)}"`)}
  </g>`;
}

function giftScene({ width, height, open, giftScale, cyFrac = 0.5, confetti = 0, seed = 0 }) {
  const rand = mulberry32(1000 + seed);
  // Art units to pixels, with the art's centre (150, 158) landing on (cx, cy).
  const s = (width * giftScale) / 260;
  const cx = width / 2;
  const cy = height * cyFrac;
  const tx = cx - 150 * s;
  const ty = cy - 158 * s;
  const at = (ux, uy) => [tx + ux * s, ty + uy * s];
  const piece = 13 * s;

  const [gx0, gy0] = at(10, 20);
  const [gx1, gy1] = at(290, 296);
  const overGift = (x, y) => x > gx0 && x < gx1 && y > gy0 && y < gy1;

  const behind = [];
  const front = [];

  if (open) {
    const [mx, my] = at(150, 128);
    behind.push(
      `<circle cx="${f1(mx)}" cy="${f1(my)}" r="${f1(width * giftScale * 0.8)}" fill="url(#g-glow)"/>`,
    );
    // A cone of confetti rising out of the mouth, densest near the middle.
    const reach = Math.min(height * 0.62, my - height * 0.03);
    for (let i = 0; i < 160; i += 1) {
      const angle = ((-90 + (rand() - 0.5) * 130) * Math.PI) / 180;
      const dist = reach * (0.1 + 0.9 * Math.sqrt(rand()));
      const x = mx + Math.cos(angle) * dist * 1.15;
      const y = my + Math.sin(angle) * dist;
      (rand() < 0.35 ? behind : front).push(confettiPiece(rand, x, y, piece * (0.7 + rand() * 0.6)));
    }
    // ...and some already drifting down past the box.
    for (let i = 0; i < 40; i += 1) {
      const x = rand() * width;
      const y = my + rand() * (height - my);
      if (!overGift(x, y)) front.push(confettiPiece(rand, x, y, piece * (0.6 + rand() * 0.5)));
    }
  } else {
    // A loose scatter around the box, never over it.
    let guard = 0;
    while (front.length < confetti && guard < confetti * 80) {
      guard += 1;
      const x = width * (0.03 + rand() * 0.94);
      const y = height * (0.03 + rand() * 0.94);
      if (!overGift(x, y)) front.push(confettiPiece(rand, x, y, piece * (0.7 + rand() * 0.6)));
    }
  }

  const sparks = open
    ? ''
    : [
        [2, 52, 16],
        [270, 32, 21],
        [-6, 190, 12],
        [276, 212, 14],
      ]
        .map(
          ([ux, uy, us]) =>
            `<path transform="translate(${f1(ux - us / 2)} ${f1(uy - us / 2)}) scale(${(us / 20).toFixed(3)})" d="${SPARK_PATH}" fill="${G.spark}" fill-opacity="0.8"/>`,
        )
        .join('');

  // In the open still the lid is caught mid-flight, the way the page throws it.
  const lid = open
    ? `<g transform="translate(-30 -128) rotate(-20 150 144)">${giftLid()}</g>`
    : giftLid();

  const prints = open
    ? [
        flyingPrint({ x: width * 0.3, y: height * 0.27, w: width * 0.34, angle: -11, photo: cakePhoto }),
        flyingPrint({ x: width * 0.7, y: height * 0.2, w: width * 0.31, angle: 9, photo: balloonsPhoto }),
      ].join('')
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0.1" y1="0" x2="0.4" y2="1">
      <stop offset="0%" stop-color="${G.stageTop}"/>
      <stop offset="100%" stop-color="${G.stageBottom}"/>
    </linearGradient>
    ${giftDefs()}
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  ${behind.join('\n  ')}
  ${prints}
  <g transform="translate(${f1(tx)} ${f1(ty)}) scale(${s.toFixed(4)})">
    ${giftBody({ open })}
    ${open ? '' : giftTag()}
    ${lid}
    ${sparks}
  </g>
  ${front.join('\n  ')}
</svg>`;
}

/* ---- sample photos -------------------------------------------------------- */

/**
 * Illustrations, deliberately, rather than stock photographs of strangers: a
 * sample that looked like somebody's real birthday would be a small lie in the
 * shopfront. Each returns an <svg> that works both as a file of its own and
 * nested inside a still, which is how the open gift's prints show them.
 */
function cakePhoto(attrs = 'xmlns="http://www.w3.org/2000/svg" width="1080" height="1350"') {
  const rand = mulberry32(21);

  const bokeh = [];
  for (let i = 0; i < 28; i += 1) {
    const r = 16 + rand() * 58;
    const colour = pick(rand, ['#ffe3b8', '#ffd0d8', '#fff4de', '#ffd28f']);
    bokeh.push(
      `<circle cx="${f1(rand() * 1080)}" cy="${f1(rand() * 800)}" r="${f1(r)}" fill="${colour}" fill-opacity="${(0.16 + rand() * 0.38).toFixed(2)}"/>`,
    );
  }

  // Icing over a tier's top, with drips hanging off its front edge.
  const icing = (cx, cy, rx, ry, colour, seed) => {
    const r = mulberry32(seed);
    const out = [
      `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${colour}"/>`,
      `<path d="M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 0 ${cx + rx} ${cy}" fill="none" stroke="${colour}" stroke-width="20" stroke-linecap="round"/>`,
    ];
    const n = Math.round(rx / 24);
    for (let i = 0; i <= n; i += 1) {
      const x = cx - rx * 0.94 + (i / n) * rx * 1.88;
      const y = cy + ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2));
      const w = 20 + r() * 14;
      const len = 24 + r() * (i % 2 ? 34 : 78);
      out.push(
        `<rect x="${f1(x - w / 2)}" y="${f1(y - 4)}" width="${f1(w)}" height="${f1(len)}" rx="${f1(w / 2)}" fill="${colour}"/>`,
      );
    }
    return out.join('');
  };

  const sprinkles = [];
  for (let i = 0; i < 46; i += 1) {
    const x = 318 + rand() * 444;
    const y = 872 + rand() * 96;
    sprinkles.push(
      `<rect x="${f1(x)}" y="${f1(y)}" width="5" height="15" rx="2.5" fill="${pick(rand, ['#f6d58e', '#9fd3c7', '#ffffff', '#d4677f', '#a9c7f0'])}" transform="rotate(${Math.round(rand() * 180)} ${f1(x)} ${f1(y)})"/>`,
    );
  }

  const candles = [478, 509, 540, 571, 602].map((x, i) => ({ x, base: 664 + [-8, 1, 7, 1, -8][i] }));
  const glows = candles
    .map(
      ({ x, base }) =>
        `<circle cx="${x}" cy="${base - 124}" r="46" fill="#ffd27a" fill-opacity="0.5" filter="url(#ck-glow)"/>`,
    )
    .join('');
  const sticks = candles
    .map(
      ({ x, base }) => `
      <rect x="${x - 6.5}" y="${base - 96}" width="13" height="96" rx="3" fill="url(#ck-stripe)"/>
      <path d="M${x} ${base - 96} V${base - 106}" stroke="#3d2b2b" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M${x} ${base - 152} C${x + 12} ${base - 131} ${x + 11} ${base - 111} ${x} ${base - 104} C${x - 11} ${base - 111} ${x - 12} ${base - 131} ${x} ${base - 152} Z" fill="url(#ck-flame)"/>`,
    )
    .join('');

  const scraps = [];
  for (let i = 0; i < 34; i += 1) {
    const x = 40 + rand() * 1000;
    const y = 1080 + rand() * 250;
    const w = 9 + rand() * 7;
    // Lying flat on the table: wide and short.
    scraps.push(
      `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w * 1.6)}" height="${f1(w * 0.5)}" rx="2" fill="${pick(rand, G.confetti)}" transform="rotate(${Math.round(rand() * 40 - 20)} ${f1(x)} ${f1(y)})"/>`,
    );
  }

  return `<svg ${attrs} viewBox="0 0 1080 1350" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="ck-bg" cx="0.5" cy="0.34" r="0.85">
      <stop offset="0" stop-color="#f7cba8"/>
      <stop offset="0.45" stop-color="#c98584"/>
      <stop offset="1" stop-color="#5a3443"/>
    </radialGradient>
    <linearGradient id="ck-table" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f3d8d2"/>
      <stop offset="1" stop-color="#d7aaa7"/>
    </linearGradient>
    <linearGradient id="ck-tier1" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fffaf6"/>
      <stop offset="0.55" stop-color="#f7e9e3"/>
      <stop offset="1" stop-color="#e3c9c2"/>
    </linearGradient>
    <linearGradient id="ck-tier2" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fbd3dc"/>
      <stop offset="0.55" stop-color="#f1adbd"/>
      <stop offset="1" stop-color="#d78ca0"/>
    </linearGradient>
    <radialGradient id="ck-flame" cx="0.5" cy="0.72" r="0.62">
      <stop offset="0" stop-color="#fffef2"/>
      <stop offset="0.45" stop-color="#ffe08f"/>
      <stop offset="1" stop-color="#ff9f45"/>
    </radialGradient>
    <pattern id="ck-stripe" width="14" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
      <rect width="14" height="18" fill="#fffaf5"/>
      <rect width="14" height="7" fill="#e58fa3"/>
    </pattern>
    <radialGradient id="ck-vignette" cx="0.5" cy="0.45" r="0.78">
      <stop offset="0.55" stop-color="#2a1016" stop-opacity="0"/>
      <stop offset="1" stop-color="#2a1016" stop-opacity="0.5"/>
    </radialGradient>
    <filter id="ck-bokeh" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter>
    <filter id="ck-soft" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
    <filter id="ck-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="16"/></filter>
  </defs>
  <rect width="1080" height="1350" fill="url(#ck-bg)"/>
  <g filter="url(#ck-bokeh)">${bokeh.join('')}</g>
  <rect y="930" width="1080" height="420" fill="url(#ck-table)"/>
  <rect y="928" width="1080" height="4" fill="#ffffff" fill-opacity="0.25"/>
  <ellipse cx="540" cy="1016" rx="362" ry="52" fill="#5a2e38" fill-opacity="0.3" filter="url(#ck-soft)"/>
  <ellipse cx="540" cy="997" rx="345" ry="52" fill="#fffdf9"/>
  <ellipse cx="540" cy="992" rx="305" ry="42" fill="#f4ebe5"/>
  <path d="M300 806 V975 A240 44 0 0 0 780 975 V806 Z" fill="url(#ck-tier1)"/>
  ${sprinkles.join('')}
  ${icing(540, 806, 240, 44, '#ec9fb1', 5)}
  <path d="M395 664 V794 A145 27 0 0 0 685 794 V664 Z" fill="url(#ck-tier2)"/>
  ${icing(540, 664, 145, 27, '#fff3ea', 9)}
  ${glows}
  ${sticks}
  ${scraps.join('')}
  <rect width="1080" height="1350" fill="url(#ck-vignette)"/>
</svg>`;
}

function balloonsPhoto(attrs = 'xmlns="http://www.w3.org/2000/svg" width="1080" height="1350"') {
  const rand = mulberry32(37);
  const TONES = {
    blush: ['#f9c9d4', '#e8899e', '#c4627c'],
    gold: ['#f9e3ad', '#e5bd6b', '#b48a3b'],
    cream: ['#fffdf8', '#f6e8d6', '#d9c6ac'],
    rose: ['#f0a3b7', '#c95774', '#953852'],
    peach: ['#fde0d1', '#f4b09a', '#d58670'],
  };

  // Back to front. The back row is smaller and softer, which is all depth of
  // field is at this size.
  const balloons = [
    { x: 290, y: 400, r: 112, tone: 'cream', blur: 4 },
    { x: 800, y: 360, r: 118, tone: 'peach', blur: 4 },
    { x: 545, y: 290, r: 124, tone: 'gold', blur: 3 },
    { x: 410, y: 545, r: 140, tone: 'blush', blur: 0 },
    { x: 690, y: 570, r: 136, tone: 'gold', blur: 0 },
    { x: 270, y: 745, r: 126, tone: 'rose', blur: 0 },
    { x: 545, y: 765, r: 146, tone: 'cream', blur: 0 },
    { x: 820, y: 775, r: 128, tone: 'blush', blur: 0 },
  ];

  const gradients = Object.entries(TONES)
    .map(
      ([name, [light, mid, dark]]) => `
    <radialGradient id="bl-${name}" cx="0.36" cy="0.3" r="0.8">
      <stop offset="0" stop-color="${light}"/>
      <stop offset="0.55" stop-color="${mid}"/>
      <stop offset="1" stop-color="${dark}"/>
    </radialGradient>`,
    )
    .join('');

  const strings = balloons
    .map(({ x, y, r }) => {
      const y1 = y + r * 1.15;
      const x2 = 540 + (x - 540) * 0.12;
      const sway = (rand() - 0.5) * 80;
      return `<path d="M${x} ${f1(y1)} C${f1(x + sway)} ${f1(y1 + 170)} ${f1(x2 - sway)} 1150 ${f1(x2)} 1400" fill="none" stroke="#b9a29a" stroke-width="2.4" stroke-opacity="0.85"/>`;
    })
    .join('');

  const drawn = balloons
    .map(({ x, y, r, tone, blur }) => {
      const [, , dark] = TONES[tone];
      const body = `M${x} ${f1(y - 1.04 * r)} C${f1(x + 0.98 * r)} ${f1(y - 1.04 * r)} ${f1(x + 1.02 * r)} ${f1(y + 0.32 * r)} ${f1(x + 0.1 * r)} ${f1(y + 1.06 * r)} L${f1(x - 0.1 * r)} ${f1(y + 1.06 * r)} C${f1(x - 1.02 * r)} ${f1(y + 0.32 * r)} ${f1(x - 0.98 * r)} ${f1(y - 1.04 * r)} ${x} ${f1(y - 1.04 * r)} Z`;
      const knot = `M${f1(x - 0.08 * r)} ${f1(y + 1.15 * r)} L${f1(x + 0.08 * r)} ${f1(y + 1.15 * r)} L${x} ${f1(y + 1.03 * r)} Z`;
      const hx = x - 0.36 * r;
      const hy = y - 0.42 * r;
      return `<g${blur ? ` filter="url(#bl-b${blur})"` : ''}>
      <path d="${body}" fill="url(#bl-${tone})"/>
      <path d="${knot}" fill="${dark}"/>
      <ellipse cx="${f1(hx)}" cy="${f1(hy)}" rx="${f1(0.15 * r)}" ry="${f1(0.29 * r)}" fill="#ffffff" fill-opacity="0.55" transform="rotate(-28 ${f1(hx)} ${f1(hy)})" filter="url(#bl-hl)"/>
    </g>`;
    })
    .join('');

  const bokeh = [];
  for (let i = 0; i < 18; i += 1) {
    bokeh.push(
      `<circle cx="${f1(rand() * 1080)}" cy="${f1(rand() * 1350)}" r="${f1(14 + rand() * 46)}" fill="${pick(rand, ['#ffffff', '#fff1d2', '#ffe0e6'])}" fill-opacity="${(0.25 + rand() * 0.35).toFixed(2)}"/>`,
    );
  }

  const falling = [];
  for (let i = 0; i < 56; i += 1) {
    falling.push(confettiPiece(rand, rand() * 1080, rand() * 1350, 22 + rand() * 14));
  }

  return `<svg ${attrs} viewBox="0 0 1080 1350" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="bl-bg" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0" stop-color="#fdeef1"/>
      <stop offset="1" stop-color="#f6d6c6"/>
    </linearGradient>
    <radialGradient id="bl-light" cx="0.18" cy="0.08" r="0.75">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.75"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    ${gradients}
    <filter id="bl-b3" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter>
    <filter id="bl-b4" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4"/></filter>
    <filter id="bl-hl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="bl-bokeh" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="10"/></filter>
  </defs>
  <rect width="1080" height="1350" fill="url(#bl-bg)"/>
  <rect width="1080" height="1350" fill="url(#bl-light)"/>
  <g filter="url(#bl-bokeh)">${bokeh.join('')}</g>
  ${strings}
  ${drawn}
  ${falling.join('')}
</svg>`;
}

const TEMPLATES = [
  {
    id: 'birthday_gift_reveal',
    scene: giftScene,
    assets: [
      { name: 'thumb.webp', width: 800, height: 1000, open: false, giftScale: 0.62, cyFrac: 0.53, confetti: 26, format: 'webp' },
      // The moment it opens: lid in the air, light, confetti, the photos coming out.
      { name: 'p1.webp', width: 828, height: 1472, open: true, giftScale: 0.66, cyFrac: 0.74, format: 'webp' },
      { name: 'og.jpg', width: 1200, height: 630, open: false, giftScale: 0.3, cyFrac: 0.52, confetti: 44, format: 'jpeg' },
    ],
    // The paths the backend registry's sampleData names.
    samples: [
      { name: 'gift-1', draw: cakePhoto },
      { name: 'gift-2', draw: balloonsPhoto },
    ],
  },
  {
    id: 'greeting_open_letter',
    scene: letterScene,
    assets: [
      // Feed card. 4:5 matches the aspect the field contracts use elsewhere.
      { name: 'thumb.webp', width: 800, height: 1000, open: false, envScale: 0.66, cyFrac: 0.5, format: 'webp' },
      // Detail carousel, phone-shaped, showing the letter actually out.
      { name: 'p1.webp', width: 828, height: 1472, open: true, envScale: 0.66, cyFrac: 0.63, format: 'webp' },
      // Link preview card. Landscape, JPEG, well under WhatsApp's size limit.
      { name: 'og.jpg', width: 1200, height: 630, open: false, envScale: 0.31, cyFrac: 0.5, format: 'jpeg' },
    ],
  },
];

const only = process.argv.slice(2);
const unknown = only.filter((id) => !TEMPLATES.some((template) => template.id === id));
if (unknown.length > 0) {
  console.error(`Unknown template: ${unknown.join(', ')}. Known: ${TEMPLATES.map((t) => t.id).join(', ')}`);
  process.exit(1);
}

const SAMPLES_DIR = fileURLToPath(new URL('../public/samples', import.meta.url));

let count = 0;
for (const template of only.length > 0 ? TEMPLATES.filter((t) => only.includes(t.id)) : TEMPLATES) {
  const dir = `${OUT_ROOT}/${template.id}`;
  mkdirSync(dir, { recursive: true });

  for (const [index, asset] of template.assets.entries()) {
    const svg = template.scene({ ...asset, seed: index });

    const pipeline = sharp(Buffer.from(svg));
    const out =
      asset.format === 'jpeg'
        ? pipeline.jpeg({ quality: 86, progressive: true, mozjpeg: true })
        : pipeline.webp({ quality: 82 });

    const info = await out.toFile(`${dir}/${asset.name}`);
    console.log(
      `  ${template.id}/${asset.name}  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(1)} KB`,
    );
    count += 1;
  }

  // The sizes and qualities an upload gets from the API's imageCompressor, so
  // the shopfront is honest about how a photo will look.
  for (const sample of template.samples ?? []) {
    mkdirSync(SAMPLES_DIR, { recursive: true });
    const svg = Buffer.from(sample.draw());
    const full = await sharp(svg).webp({ quality: 75 }).toFile(`${SAMPLES_DIR}/${sample.name}.webp`);
    const thumb = await sharp(svg)
      .resize({ width: 512, height: 512, fit: 'inside' })
      .webp({ quality: 60 })
      .toFile(`${SAMPLES_DIR}/${sample.name}-t.webp`);
    console.log(`  samples/${sample.name}.webp  ${full.width}x${full.height}  ${(full.size / 1024).toFixed(1)} KB`);
    console.log(`  samples/${sample.name}-t.webp  ${thumb.width}x${thumb.height}  ${(thumb.size / 1024).toFixed(1)} KB`);
    count += 2;
  }
}

// Shared files are rebuilt only on a full run.
if (only.length > 0) {
  console.log(`\n✓ ${count} asset(s) written under web/public/\n`);
  process.exit(0);
}

/**
 * A stand-in photo for the `with-photo` fixture, at the 4:5 the field contract
 * declares. Deliberately an out-of-focus abstract rather than anything
 * resembling a real photograph — its job is to prove the layout holds around an
 * image of the right shape, and a fixture that looked like a real family photo
 * would be a small lie in the test suite.
 */
const fixturesDir = fileURLToPath(new URL('../public/fixtures', import.meta.url));
mkdirSync(fixturesDir, { recursive: true });

const blobs = [
  { cx: 0.32, cy: 0.3, r: 0.42, fill: '#e8b9a6', op: 0.9 },
  { cx: 0.74, cy: 0.22, r: 0.34, fill: '#f3d9c4', op: 0.85 },
  { cx: 0.62, cy: 0.68, r: 0.46, fill: '#c98f86', op: 0.75 },
  { cx: 0.22, cy: 0.82, r: 0.38, fill: '#f0c9b4', op: 0.7 },
]
  .map(
    (b) =>
      `<circle cx="${(b.cx * 1080).toFixed(0)}" cy="${(b.cy * 1350).toFixed(0)}" r="${(b.r * 1080).toFixed(0)}" fill="${b.fill}" opacity="${b.op}"/>`,
  )
  .join('\n    ');

const photoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <defs>
    <filter id="blur"><feGaussianBlur stdDeviation="90"/></filter>
  </defs>
  <rect width="1080" height="1350" fill="#d9a892"/>
  <g filter="url(#blur)">
    ${blobs}
  </g>
</svg>`;

const photoInfo = await sharp(Buffer.from(photoSvg)).webp({ quality: 78 }).toFile(`${fixturesDir}/photo-4x5.webp`);
console.log(`  fixtures/photo-4x5.webp  ${photoInfo.width}x${photoInfo.height}  ${(photoInfo.size / 1024).toFixed(1)} KB`);
count += 1;

/**
 * Favicons.
 *
 * `favicon.ico` exists because browsers ask for it whether or not the page
 * links one, and every unanswered request used to cost a server-rendered 404.
 * It is a real ICO: the format permits a PNG payload verbatim, so this is a
 * 6-byte directory header plus one 16-byte entry wrapped around a 32x32 PNG.
 *
 * `apple-touch-icon.png` matters more than it looks — these links are opened on
 * phones and kept, and "add to home screen" otherwise screenshots the page.
 */
const markSvg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="${P.stageBottom}"/>
  <path d="M6 11.5h20v13a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 6 24.5z" fill="${P.paper}"/>
  <path d="M6 11.5 16 19l10-7.5" fill="none" stroke="${P.accent}" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="16" cy="10" r="4.5" fill="${P.accentDeep}"/>
</svg>`;

const publicDir = fileURLToPath(new URL('../public', import.meta.url));

const icoPng = await sharp(Buffer.from(markSvg(32))).resize(32, 32).png().toBuffer();
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // one image
const entry = Buffer.alloc(16);
entry[0] = 32; // width
entry[1] = 32; // height
entry[2] = 0; // palette: none
entry[3] = 0; // reserved
entry.writeUInt16LE(1, 4); // colour planes
entry.writeUInt16LE(32, 6); // bits per pixel
entry.writeUInt32LE(icoPng.length, 8);
entry.writeUInt32LE(header.length + entry.length, 12); // offset to the payload
writeFileSync(`${publicDir}/favicon.ico`, Buffer.concat([header, entry, icoPng]));
console.log(`  favicon.ico              32x32  ${((header.length + entry.length + icoPng.length) / 1024).toFixed(1)} KB`);

const touch = await sharp(Buffer.from(markSvg(180)))
  .resize(180, 180)
  .flatten({ background: P.stageBottom })
  .png()
  .toFile(`${publicDir}/apple-touch-icon.png`);
console.log(`  apple-touch-icon.png     ${touch.width}x${touch.height}  ${(touch.size / 1024).toFixed(1)} KB`);
count += 2;

console.log(`\n✓ ${count} asset(s) written under web/public/\n`);
