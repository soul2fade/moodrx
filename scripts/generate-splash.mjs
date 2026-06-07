import sharp from 'sharp';
import { readFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Source fonts from @expo-google-fonts/space-grotesk (already a runtime
// dependency for the app's text) rather than from assets/fonts/. The
// previous local copies under assets/fonts/SpaceGrotesk-*.ttf were
// silently HTML — a download from github.com that hit the auth-walled
// "raw" URL and saved the login page bytes as .ttf — so this script
// was embedding GitHub markup into the splash SVG and producing
// glyph-less output.
function loadTrueTypeFont(relPath) {
  const buf = readFileSync(new URL(relPath, import.meta.url));
  // Real TrueType files begin with the magic `00 01 00 00` (or `OTTO`
  // for CFF / `true` for legacy Apple). Fail loudly if we accidentally
  // pick up HTML or another broken download in the future.
  const magic = buf.subarray(0, 4);
  const ok =
    (magic[0] === 0x00 && magic[1] === 0x01 && magic[2] === 0x00 && magic[3] === 0x00) ||
    magic.toString('ascii') === 'OTTO' ||
    magic.toString('ascii') === 'true';
  if (!ok) {
    throw new Error(
      `Expected TrueType magic at start of ${relPath} but got ${magic.toString('hex')}. ` +
      'Check that the font wasn\'t replaced with an HTML download.',
    );
  }
  return buf.toString('base64');
}

const fontRegular = loadTrueTypeFont('../node_modules/@expo-google-fonts/space-grotesk/400Regular/SpaceGrotesk_400Regular.ttf');
const fontLight   = loadTrueTypeFont('../node_modules/@expo-google-fonts/space-grotesk/300Light/SpaceGrotesk_300Light.ttf');

// Three-bar logo + MoodRx wordmark as SVG, white on transparent
// Rendered at 3× (1200×1560) so it stays crisp on high-density screens
const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1560" viewBox="0 0 1200 1560">
  <defs>
    <style>
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
    </style>
  </defs>

  <!-- Three bars logo — white, matching the original proportions -->
  <rect x="264" y="180" width="186" height="780" fill="white"/>
  <rect x="507" y="420" width="186" height="540" fill="white"/>
  <rect x="750" y="180" width="186" height="780" fill="white"/>

  <!-- MoodRx wordmark -->
  <text
    x="600"
    y="1185"
    font-family="SpaceGrotesk"
    font-size="148"
    font-weight="300"
    letter-spacing="12"
    fill="white"
    text-anchor="middle"
    dominant-baseline="middle"
  >MoodRx</text>

  <!-- Tagline -->
  <text
    x="600"
    y="1350"
    font-family="SpaceGrotesk"
    font-size="42"
    font-weight="300"
    letter-spacing="12"
    fill="rgba(255,255,255,0.45)"
    text-anchor="middle"
    dominant-baseline="middle"
  >YOUR PRESCRIPTION</text>
</svg>
`;

// fileURLToPath instead of .pathname so this works on Windows
// (file:///C:/foo => /C:/foo via .pathname, which Sharp can't open).
const outputPath = fileURLToPath(new URL('../assets/images/splash-icon.png', import.meta.url));

await sharp(Buffer.from(svgContent))
  .png()
  .toFile(outputPath);

console.log('Splash icon generated →', outputPath);

// Also generate a square app icon (1024×1024, black bg) for home screen
const iconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#0a0a0a"/>
  <!-- Three bars, proportionally scaled up -->
  <rect x="226" y="242" width="158" height="540" fill="white"/>
  <rect x="433" y="404" width="158" height="378" fill="white"/>
  <rect x="640" y="242" width="158" height="540" fill="white"/>
</svg>
`;

const iconPath = fileURLToPath(new URL('../assets/images/icon.png', import.meta.url));
await sharp(Buffer.from(iconSvg)).png().toFile(iconPath);
console.log('App icon generated →', iconPath);

// Adaptive icon foreground (same bars, transparent bg) for Android
const adaptiveSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect x="226" y="242" width="158" height="540" fill="white"/>
  <rect x="433" y="404" width="158" height="378" fill="white"/>
  <rect x="640" y="242" width="158" height="540" fill="white"/>
</svg>
`;

const adaptivePath = fileURLToPath(new URL('../assets/images/adaptive-icon.png', import.meta.url));
await sharp(Buffer.from(adaptiveSvg)).png().toFile(adaptivePath);
console.log('Adaptive icon generated →', adaptivePath);
