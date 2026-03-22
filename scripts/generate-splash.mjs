import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Three-bar logo + MoodRx wordmark as SVG, white on transparent
// Bars: left tall | middle shorter | right tall — matching the uploaded logo geometry
const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="520" viewBox="0 0 400 520">
  <!-- Three bars logo — white, matching the original proportions -->
  <!-- Left bar -->
  <rect x="88"  y="60"  width="62" height="260" fill="white"/>
  <!-- Middle bar (starts lower, same bottom) -->
  <rect x="169" y="140" width="62" height="180" fill="white"/>
  <!-- Right bar -->
  <rect x="250" y="60"  width="62" height="260" fill="white"/>

  <!-- MoodRx wordmark -->
  <text
    x="200"
    y="395"
    font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
    font-size="52"
    font-weight="300"
    letter-spacing="8"
    fill="white"
    text-anchor="middle"
    dominant-baseline="middle"
  >MOODRX</text>

  <!-- Tagline -->
  <text
    x="200"
    y="450"
    font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
    font-size="14"
    font-weight="300"
    letter-spacing="4"
    fill="rgba(255,255,255,0.45)"
    text-anchor="middle"
    dominant-baseline="middle"
  >YOUR PRESCRIPTION</text>
</svg>
`;

const outputPath = new URL('../assets/images/splash-icon.png', import.meta.url).pathname;

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

const iconPath = new URL('../assets/images/icon.png', import.meta.url).pathname;
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

const adaptivePath = new URL('../assets/images/adaptive-icon.png', import.meta.url).pathname;
await sharp(Buffer.from(adaptiveSvg)).png().toFile(adaptivePath);
console.log('Adaptive icon generated →', adaptivePath);
