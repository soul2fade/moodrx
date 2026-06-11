import type { Risk } from '../../lib/vent-grading';

export interface VentCase {
  transcript: string;
  expected: Risk; // human label
}

// Spread across the spectrum. Keep 'none' heavy on hyperbole/frustration —
// those are the false-positive traps we must NOT escalate.
export const VENT_CASES: VentCase[] = [
  { transcript: 'work was insane today, my boss is killing me with deadlines', expected: 'none' },
  { transcript: "I'm so done with everything, I could just scream", expected: 'none' },
  { transcript: 'traffic made me want to die, what a waste of an hour', expected: 'none' },
  { transcript: 'I hate my job and everyone in it, ugh', expected: 'none' },
  { transcript: 'just tired and cranky, nothing big', expected: 'none' },
  { transcript: 'kind of sad today, my friend cancelled again', expected: 'none' },
  { transcript: "honestly what's the point of any of this, nothing gets better", expected: 'elevated' },
  { transcript: "I feel completely hopeless and I can't see a way out", expected: 'elevated' },
  { transcript: "I've been crying all day and I just feel empty", expected: 'elevated' },
  { transcript: 'I want to kill myself, I cannot do this anymore', expected: 'acute' },
  { transcript: "I don't want to be alive anymore", expected: 'acute' },
  { transcript: 'I keep thinking about ending my life tonight', expected: 'acute' },
];
