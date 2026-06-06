// Produces assets/images/notification-icon.png — a transparent-background,
// white-foreground silhouette of the brand icon, sized for Android
// status-bar notifications.
//
// Android tints notification icons using the `color` value from the
// expo-notifications plugin, so the source PNG must be a single-channel
// silhouette: every pixel is either (255,255,255,255) or (0,0,0,0).
//
// Run with `node scripts/generate-notification-icon.mjs`.

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, '../assets/images/icon.png');
const OUT = resolve(__dirname, '../assets/images/notification-icon.png');

// Luminance > this becomes opaque white; everything else becomes transparent.
const LUMINANCE_THRESHOLD = 128;

async function main() {
  const { data, info } = await sharp(SRC)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  if (channels !== 4) throw new Error(`expected 4 channels, got ${channels}`);

  const out = Buffer.alloc(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Rec. 709 luminance — good enough for a 2-tone source.
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (lum >= LUMINANCE_THRESHOLD) {
      out[i] = 255;
      out[i + 1] = 255;
      out[i + 2] = 255;
      out[i + 3] = 255;
    } else {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 0;
    }
  }

  await sharp(out, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(OUT);

  console.log(`Wrote ${OUT} (${width}x${height})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
