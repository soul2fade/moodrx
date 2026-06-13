export const MICRO_WORKOUT_ID = 'micro-bad-day';
export const MICRO_WORKOUT_NAME = 'Bad Day Minimum';

export const MICRO_WORKOUT_STEPS = [
  '4-7-8 breath × 3. In for 4, hold 7, out for 8. No performance review.',
  'Stand up. Seriously. The workout starts when your feet touch the floor.',
  '20 slow steps. Kitchen to door and back counts. We are not picky.',
  'Done. That counted. Your streak survives.',
];

export const MICRO_WORKOUT_DURATION_MIN = 2;

import type { MoodKey } from './storage';

// Each mood gets a 2-minute routine matching the character of its real workouts
// (see lib/workouts.ts): anxious → rhythmic/breath, low → activation, foggy →
// sharp wake-up, restless → burn it off, stressed → release tension, good → bank
// the win. Copy is Dr. MoodRx voice; tunable by the owner.
export const MICRO_WORKOUTS_BY_MOOD: Record<MoodKey, string[]> = {
  anxious: [
    '4-7-8 breath × 3. In for 4, hold 7, out for 8. No performance review.',
    'Roll your shoulders back 5 times and unclench your jaw.',
    '20 slow steps — count them in 4s. Gives your anxious brain a job.',
    'Done. Alarm system got a break. Your streak survives.',
  ],
  low: [
    'Stand up. The workout starts the second your feet hit the floor.',
    '10 slow bodyweight squats. Stand up taller than you sat down.',
    'Shake your arms out, roll your neck. Wake the engine.',
    'Done. You forced the reboot. Your streak survives.',
  ],
  foggy: [
    '20 fast jumping jacks. Blow the dust off.',
    '10 sharp shadowbox jabs — left, right, repeat. Eyes up.',
    'Cold water on your face, or step outside for 20 breaths.',
    'Done. Tabs cleared. Your streak survives.',
  ],
  restless: [
    '30 seconds of the fastest squats you can do. Burn it off.',
    'Shake every limb out, hard, for 15 seconds. Rattle the can.',
    '10 push-ups — knees are fine. Spend the leftover voltage.',
    'Done. Pressure released, safely. Your streak survives.',
  ],
  stressed: [
    'Forward fold. Let your head and arms just hang for 30 seconds.',
    'Roll your shoulders back 10 times. Drop them from your ears.',
    '4-7-8 breath × 3. In for 4, hold 7, out for 8.',
    'Done. Shoulders came down. Your streak survives.',
  ],
  good: [
    'You showed up functional — let us not waste it. Stand up.',
    '15 bodyweight squats, a little faster than comfortable.',
    '10 push-ups or a 20-second plank. Bank the good day.',
    'Done. Momentum logged. Your streak survives.',
  ],
};

/** The mood-specific 2-minute routine, or the generic steps for an unknown mood. */
export function microStepsForMood(mood: MoodKey): string[] {
  return MICRO_WORKOUTS_BY_MOOD[mood] ?? MICRO_WORKOUT_STEPS;
}
