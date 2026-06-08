// Produces assets/images/monochrome-icon.png — the Android 13+ themed
// ("monochrome") adaptive-icon layer. When the user turns on themed icons,
// Android ignores the layer's color and tints it to match their wallpaper, so
// the source must be a flat single-color silhouette on transparent.
//
// Sourced from adaptive-icon.png (NOT icon.png) so the mark keeps the same
// adaptive-foreground framing/padding as the regular launcher icon. That file
// is already white bars on transparent; this just forces the RGB to pure white
// while preserving the original (anti-aliased) alpha for clean edges.
//
// Run with `node scripts/generate-monochrome-icon.mjs`.

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, '../assets/images/adaptive-icon.png');
const OUT = resolve(__dirname, '../assets/images/monochrome-icon.png');

async function main() {
  const { data, info } = await sharp(SRC)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  if (channels !== 4) throw new Error(`expected 4 channels, got ${channels}`);

  const out = Buffer.alloc(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    // Force pure white, keep the source alpha (soft edges intact).
    out[i] = 255;
    out[i + 1] = 255;
    out[i + 2] = 255;
    out[i + 3] = data[i + 3];
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
