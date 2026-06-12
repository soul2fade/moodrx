import { createHash } from 'node:crypto';

/** Canonical form for comparison/dedup: lowercase, punctuation stripped to
 *  spaces, whitespace collapsed, trimmed. Intentionally lossy — two lines that
 *  differ only in casing/punctuation are the "same" insult. */
export function normalizeInsult(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Stable 12-hex-char id derived from the normalized text, so the same insult
 *  always maps to the same id (and audio filename) across runs. */
export function insultId(text: string): string {
  return createHash('sha1').update(normalizeInsult(text)).digest('hex').slice(0, 12);
}

/** Return only the candidates whose normalized form is neither already in
 *  `existing` nor an earlier duplicate within the same batch. Preserves the
 *  original (un-normalized) candidate strings and their order. */
export function dedupeNew(existing: string[], candidates: string[]): string[] {
  const seen = new Set(existing.map(normalizeInsult));
  const out: string[] = [];
  for (const c of candidates) {
    const n = normalizeInsult(c);
    if (n.length === 0 || seen.has(n)) continue;
    seen.add(n);
    out.push(c);
  }
  return out;
}
