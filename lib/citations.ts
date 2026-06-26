import { SUPPLEMENTS } from './supplements';
import { WORKOUTS } from './workouts';

/** Every health/medical claim in MoodRx is backed by a peer-reviewed source.
 *  Citations live inline (on supplement and workout cards) AND collected here
 *  for the central "The Science" screen, so they're easy for any user to find.
 *
 *  We don't hard-code a DOI per citation (brittle / 404-prone). Instead each
 *  citation links to a Google Scholar search of its full reference string,
 *  which reliably resolves to the paper and never dead-links. */
export function citationUrl(citation: string): string {
  return `https://scholar.google.com/scholar?q=${encodeURIComponent(citation)}`;
}

function uniqueSorted(arrays: string[][]): string[] {
  const set = new Set<string>();
  for (const arr of arrays) for (const s of arr) set.add(s);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/** Deduped, alphabetized citations drawn straight from the supplement and
 *  workout data — so the Science screen can never drift out of sync with the
 *  citations shown inline. */
export const SUPPLEMENT_CITATIONS: string[] = uniqueSorted(SUPPLEMENTS.map((s) => s.sources));
export const WORKOUT_CITATIONS: string[] = uniqueSorted(WORKOUTS.map((w) => w.sources));

export const CITATION_GROUPS: { title: string; citations: string[] }[] = [
  { title: 'Movement & workouts', citations: WORKOUT_CITATIONS },
  { title: 'Supplements', citations: SUPPLEMENT_CITATIONS },
];
