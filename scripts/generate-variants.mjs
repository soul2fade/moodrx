import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';

const fontRegular = readFileSync(new URL('../assets/fonts/SpaceGrotesk-Regular.ttf', import.meta.url).pathname).toString('base64');
const fontLight   = readFileSync(new URL('../assets/fonts/SpaceGrotesk-Light.ttf',   import.meta.url).pathname).toString('base64');

const fontFace = `
  @font-face {
    font-family: 'SpaceGrotesk';
    font-weight: 300;
    src: url('data:font/truetype;base64,${fontLight}') format('truetype');
  }
  @font-face {
    font-family: 'SpaceGrotesk';
    font-weight: 400;
    src: url('data:font/truetype;base64,${fontRegular}') format('truetype');
  }
`;

const bars = `
  <rect x="264" y="180" width="186" height="780" fill="white"/>
  <rect x="507" y="420" width="186" height="540" fill="white"/>
  <rect x="750" y="180" width="186" height="780" fill="white"/>
`;

const tagline = `
  <text
    x="600" y="1350"
    font-family="SpaceGrotesk" font-size="42" font-weight="300"
    letter-spacing="12" fill="rgba(255,255,255,0.45)"
    text-anchor="middle" dominant-baseline="middle"
  >YOUR PRESCRIPTION</text>
`;

// ── Variant A: MoodRx (mixed case) ──────────────────────────────
const svgA = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1560" viewBox="0 0 1200 1560">
  <defs><style>${fontFace}</style></defs>
  ${bars}
  <text
    x="600" y="1185"
    font-family="SpaceGrotesk" font-size="148" font-weight="300"
    letter-spacing="12" fill="white"
    text-anchor="middle" dominant-baseline="middle"
  >MoodRx</text>
  ${tagline}
</svg>`;

// ── Variant B: Mood ℞ (with prescription symbol) ─────────────────
const svgB = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1560" viewBox="0 0 1200 1560">
  <defs><style>${fontFace}</style></defs>
  ${bars}
  <text
    x="600" y="1185"
    font-family="SpaceGrotesk" font-size="148" font-weight="300"
    letter-spacing="12" fill="white"
    text-anchor="middle" dominant-baseline="middle"
  >Mood &#x211E;</text>
  ${tagline}
</svg>`;

const outA = new URL('../assets/images/splash-variant-a.png', import.meta.url).pathname;
const outB = new URL('../assets/images/splash-variant-b.png', import.meta.url).pathname;

await sharp(Buffer.from(svgA)).png().toFile(outA);
console.log('Variant A (MoodRx) →', outA);

await sharp(Buffer.from(svgB)).png().toFile(outB);
console.log('Variant B (Mood ℞) →', outB);
