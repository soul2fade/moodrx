/**
 * Male workout guide voice — the pre-recorded transition clips already used
 * during workouts. No system TTS. Trash talk is separate (see workout.tsx).
 */

export const ACTIVE_COMPLETE_AUDIO = [
  require('../assets/audio/transitions/active_complete_01.mp3'),
  require('../assets/audio/transitions/active_complete_02.mp3'),
  require('../assets/audio/transitions/active_complete_03.mp3'),
  require('../assets/audio/transitions/active_complete_04.mp3'),
] as const;

export const REST_COMPLETE_AUDIO = [
  require('../assets/audio/transitions/rest_complete_01.mp3'),
  require('../assets/audio/transitions/rest_complete_02.mp3'),
  require('../assets/audio/transitions/rest_complete_03.mp3'),
  require('../assets/audio/transitions/rest_complete_04.mp3'),
  require('../assets/audio/transitions/rest_complete_05.mp3'),
] as const;

/** Pick the guide clip for a workout step (same male voice, rotates by step). */
export function pickWorkoutGuideCue(stepIndex: number, isRestStep: boolean): number {
  const pool = isRestStep ? REST_COMPLETE_AUDIO : ACTIVE_COMPLETE_AUDIO;
  return pool[stepIndex % pool.length];
}

/** Timer finished — same voice, index-based so it stays consistent per step. */
export function pickWorkoutGuideTimerCue(stepIndex: number, isRestStep: boolean): number {
  return pickWorkoutGuideCue(stepIndex, isRestStep);
}
