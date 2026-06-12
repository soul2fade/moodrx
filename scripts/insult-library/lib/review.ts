import { insultId, normalizeInsult } from './text';

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface ReviewEntry {
  id: string;
  text: string;
  status: ReviewStatus;
}

/** The on-disk shape of a `<tier>.review.json` file. */
export interface ReviewFile {
  tier: string;
  entries: ReviewEntry[];
}

/** Append new candidate texts to an existing entry list as `pending`, skipping
 *  any whose normalized form already exists (dedup) so a re-run never duplicates
 *  a line or resets a human's prior approve/reject decision. Returns a new array;
 *  inputs are not mutated. */
export function mergeCandidates(existing: ReviewEntry[], candidates: string[]): ReviewEntry[] {
  const seen = new Set(existing.map((e) => normalizeInsult(e.text)));
  const additions: ReviewEntry[] = [];
  for (const text of candidates) {
    const n = normalizeInsult(text);
    if (n.length === 0 || seen.has(n)) continue;
    seen.add(n);
    additions.push({ id: insultId(text), text, status: 'pending' });
  }
  return [...existing, ...additions];
}

/** Only `approved` lines are ever voiced. */
export function selectApproved(entries: ReviewEntry[]): ReviewEntry[] {
  return entries.filter((e) => e.status === 'approved');
}
