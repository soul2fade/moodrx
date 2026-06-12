import { sessionDateString, type Session } from '@/lib/storage';

// ─── Pattern engine (Unit A) ─────────────────────────────────────────────────
//
// Pure, on-device. Turns the session log into observational pattern items under
// a tiered-honesty gate: below a floor → nothing; gray zone → a hedged QUESTION;
// strong effect → a confident FINDING. Templated text only — no LLM, no network.

export type Tier = 'none' | 'question' | 'finding';

export interface PatternItem {
  /** Stable per-signal key (also a React key for the insights UI). */
  id: 'time-of-day' | 'day-of-week' | 'consistency';
  /** Templated, in-app-voice phrasing. */
  text: string;
  kind: 'finding' | 'question';
}

// Effect/observation thresholds. Tuned so a flat/random log yields zero findings
// (see the noise-set test) while real effects cross into question/finding.
const MIN_OBS_PER_BUCKET = 4;   // time-of-day & consistency: per-bucket minimum
const EFFECT_GRAY = 1.0;        // improvement-point gap → hedged question
const EFFECT_STRONG = 2.0;      // improvement-point gap → confident finding
const MIN_OBS_PER_WEEKDAY = 3;  // day-of-week: sessions needed on a weekday
const ROUGH_GRAY = 1.5;         // intensity-point gap above other days → question
const ROUGH_STRONG = 2.5;       // intensity-point gap above other days → finding

/** Sign-adjusted so a larger number always means a better outcome: for every
 *  mood except 'good' a LOWER post-score is better, so flip the sign there. */
export function sessionImprovement(s: Session): number {
  return s.mood === 'good' ? s.postScore - s.intensity : s.intensity - s.postScore;
}

function mean(nums: number[]): number {
  return nums.length === 0 ? 0 : nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** The tiered-honesty gate. `obs` is the binding observation count (e.g. the
 *  smaller of two buckets); `effect` is the absolute effect size. Below the
 *  floor or below `gray` → 'none'; >= `strong` → 'finding'; else 'question'. */
export function classifyTier(
  obs: number,
  minObs: number,
  effect: number,
  gray: number,
  strong: number,
): Tier {
  if (obs < minObs || effect < gray) return 'none';
  return effect >= strong ? 'finding' : 'question';
}

/** Time-of-day: does morning or evening reliably help more? Buckets by the
 *  session's LOCAL hour (getHours on the stored epoch ms). */
export function detectTimeOfDay(sessions: Session[]): PatternItem | null {
  const morning: number[] = [];
  const evening: number[] = [];
  for (const s of sessions) {
    const hour = new Date(s.timestamp).getHours();
    (hour < 12 ? morning : evening).push(sessionImprovement(s));
  }
  const obs = Math.min(morning.length, evening.length);
  const mMean = mean(morning);
  const eMean = mean(evening);
  const effect = Math.abs(mMean - eMean);
  const tier = classifyTier(obs, MIN_OBS_PER_BUCKET, effect, EFFECT_GRAY, EFFECT_STRONG);
  if (tier === 'none') return null;

  const part = mMean >= eMean ? 'morning' : 'evening';
  const Part = part === 'morning' ? 'Morning' : 'Evening';
  const text =
    tier === 'finding'
      ? `Your mood lifts most after ${part} sessions.`
      : `${Part} sessions might be landing better for you — worth watching?`;
  return { id: 'time-of-day', text, kind: tier };
}

const WEEKDAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;

/** Day-of-week roughness: the weekday with the biggest positive gap in mean
 *  pre-workout intensity vs every other day — "you show up more wound up". */
export function detectDayOfWeek(sessions: Session[]): PatternItem | null {
  const byDow: number[][] = [[], [], [], [], [], [], []];
  for (const s of sessions) {
    const dow = new Date(sessionDateString(s) + 'T00:00:00').getDay();
    byDow[dow].push(s.intensity);
  }
  let best = -1;
  let bestEffect = 0; // only a strictly-rougher weekday qualifies
  for (let dow = 0; dow < 7; dow++) {
    if (byDow[dow].length < MIN_OBS_PER_WEEKDAY) continue;
    const others = byDow.filter((_, i) => i !== dow).flat();
    if (others.length === 0) continue;
    const effect = mean(byDow[dow]) - mean(others);
    if (effect > bestEffect) {
      bestEffect = effect;
      best = dow;
    }
  }
  if (best === -1) return null;

  const tier = classifyTier(byDow[best].length, MIN_OBS_PER_WEEKDAY, bestEffect, ROUGH_GRAY, ROUGH_STRONG);
  if (tier === 'none') return null;

  const day = WEEKDAY_NAMES[best];
  const text =
    tier === 'finding'
      ? `${day}s run rough — you show up more wound up than on your other days.`
      : `Your ${day}s have been running a little rough — anything recurring?`;
  return { id: 'day-of-week', text, kind: tier };
}
