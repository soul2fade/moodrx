import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ─── Readability guard (enforces memory `readability-standard`) ───────────────
// The app's grey TEXT keeps regressing to "too dim". This fails CI if any TEXT
// `color:` in app/ or components/ is a NEAR-GREY dimmer than ~#c5 on the dark
// background. Screens must use the type tokens (lib/typography) or a light grey.
//
// Only matches the lowercase `color:` style property — `borderColor`,
// `backgroundColor`, `shadowColor`, `tintColor` (capital C) are NOT text and are
// intentionally excluded. Near-black values (< #20) are excluded too: those are
// deliberate DARK text on a light/colored background (e.g. text on a bright pill).

const ROOTS = ['app', 'components'];
const COLOR_RE = /\bcolor:\s*'#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})'/g;
const MIN_CHANNEL = 0xc5;        // grey text must be at least this light
const NEAR_GREY_SPREAD = 18;     // max channel spread to count as a "grey"
const DARK_ON_LIGHT = 0x20;      // below this = intentional dark-on-light text

function walkTsx(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walkTsx(p));
    else if (p.endsWith('.tsx') || p.endsWith('.ts')) out.push(p);
  }
  return out;
}

function toRgb(hex: string): [number, number, number] {
  const h = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

describe('readability guard', () => {
  it('has no near-grey TEXT color dimmer than ~#c5 in app/ or components/', () => {
    const root = process.cwd();
    const offenders: string[] = [];
    for (const r of ROOTS) {
      for (const file of walkTsx(join(root, r))) {
        readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
          COLOR_RE.lastIndex = 0;
          let m: RegExpExecArray | null;
          while ((m = COLOR_RE.exec(line)) !== null) {
            const [rr, gg, bb] = toRgb(m[1]);
            const min = Math.min(rr, gg, bb);
            const isNearGrey = Math.max(rr, gg, bb) - min <= NEAR_GREY_SPREAD;
            if (isNearGrey && min >= DARK_ON_LIGHT && min < MIN_CHANNEL) {
              offenders.push(`${file.slice(root.length + 1)}:${i + 1}  #${m[1]}`);
            }
          }
        });
      }
    }
    expect(
      offenders,
      `Dim grey TEXT color(s) found — use a type token or lighten to >= #c5c5c5:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
