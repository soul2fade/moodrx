import { sessionDateString, type Session } from '@/lib/storage';
import { toDateString } from '@/lib/dateUtils';

// ─── Pattern engine (Unit A) ─────────────────────────────────────────────────
//
// Pure, on-device. Turns the session log into observational pattern items under
// a tiered-honesty gate: below a floor → nothing; gray zone → a hedged QUESTION;
// strong effect → a confident FINDING. Templated text only — no LLM, no network.

export type Tier = 'none' | 'question' | 'finding';

export interface PatternItem {
  /** Stable per-signal key (also a React key for the insights UI). */
  id: 'time-of-day' | 'day-of-week' | 'consistency' | 'sleep';
  /** Templated, in-app-voice phrasing. */
  text: string;
  kind: 'finding' | 'question';
}

// Effect/observation thresholds. Tuned so a flat/random log yields zero findings
// (see the noise-set test) while real effects cross into question/finding.
const MIN_OBS_PER_BUCKET = 4;   // time-of-day & consistency: per-bucket minimum
const EFFECT_GRAY = 1.0;        // improvement-point gap → hedged question
const EFFECT_STRONG = 2.0;      // improvement-point gap → confident finding
const MIN_OBS_PER_WEEKDAY = 3;         // day-of-week: entry floor → at most a question
const MIN_FINDING_OBS_PER_WEEKDAY = 5; // a confident finding needs a deeper weekday bucket
const MIN_OTHERS_FOR_FINDING = 8;      // …measured against a non-thin comparison pool
const ROUGH_GRAY = 1.5;                // intensity-point gap above other days → question
const ROUGH_STRONG = 2.5;              // intensity-point gap above other days → finding
const REST_THRESHOLD_HOURS = 7; // sleep at/above this counts as a "rested" night

/** Sign-adjusted so a larger number always means a better outcome: for every
 *  mood except 'good' a LOWER post-score is better, so flip the sign there. */
export function sessionImprovement(
  s: { mood: Session['mood']; intensity: number; postScore: number },
): number {
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
  let bestOthersLen = 0;
  for (let dow = 0; dow < 7; dow++) {
    if (byDow[dow].length < MIN_OBS_PER_WEEKDAY) continue;
    const others = byDow.filter((_, i) => i !== dow).flat();
    if (others.length === 0) continue;
    const effect = mean(byDow[dow]) - mean(others);
    if (effect > bestEffect) {
      bestEffect = effect;
      best = dow;
      bestOthersLen = others.length;
    }
  }
  if (best === -1) return null;

  const tier = classifyTier(byDow[best].length, MIN_OBS_PER_WEEKDAY, bestEffect, ROUGH_GRAY, ROUGH_STRONG);
  if (tier === 'none') return null;

  // Honesty downgrade: a confident weekday claim needs a deeper bucket AND a
  // non-thin comparison pool; thin evidence is at most a hunch (question).
  const earnedFinding =
    byDow[best].length >= MIN_FINDING_OBS_PER_WEEKDAY && bestOthersLen >= MIN_OTHERS_FOR_FINDING;
  const finalTier: 'finding' | 'question' = tier === 'finding' && earnedFinding ? 'finding' : 'question';

  const day = WEEKDAY_NAMES[best];
  const text =
    finalTier === 'finding'
      ? `${day}s run rough — you show up more wound up than on your other days.`
      : `Your ${day}s have been running a little rough — anything recurring?`;
  return { id: 'day-of-week', text, kind: finalTier };
}

/** The local YYYY-MM-DD calendar day before `dateStr` (DST-safe via setDate). */
function prevDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return toDateString(d.getTime());
}

/** Consistency: does stacking days back-to-back help more than starting cold
 *  after a gap? Compares mean day-level improvement between the two groups. */
export function detectConsistency(sessions: Session[]): PatternItem | null {
  // Day-level mean improvement.
  const byDay = new Map<string, { sum: number; count: number }>();
  for (const s of sessions) {
    const d = sessionDateString(s);
    const agg = byDay.get(d) ?? { sum: 0, count: 0 };
    agg.sum += sessionImprovement(s);
    agg.count += 1;
    byDay.set(d, agg);
  }
  const present = new Set(byDay.keys());
  const backToBack: number[] = [];
  const afterGap: number[] = [];
  for (const [d, agg] of byDay) {
    const dayImprovement = agg.sum / agg.count;
    (present.has(prevDay(d)) ? backToBack : afterGap).push(dayImprovement);
  }

  const obs = Math.min(backToBack.length, afterGap.length);
  const bMean = mean(backToBack);
  const gMean = mean(afterGap);
  const effect = Math.abs(bMean - gMean);
  const tier = classifyTier(obs, MIN_OBS_PER_BUCKET, effect, EFFECT_GRAY, EFFECT_STRONG);
  if (tier === 'none') return null;

  const stackedBetter = bMean >= gMean;
  const text =
    tier === 'finding'
      ? stackedBetter
        ? "You get more out of your sessions when you don't skip days."
        : 'A day off between sessions seems to set up a better one.'
      : stackedBetter
        ? 'Stacking days back-to-back might be working better — worth keeping up?'
        : 'A rest day between sessions might be helping — worth noticing?';
  return { id: 'consistency', text, kind: tier };
}

/** Sleep: do sessions after a fuller night's sleep improve more? Compares mean
 *  improvement on rested (>= REST_THRESHOLD_HOURS) vs short nights. Only sessions
 *  that captured `sleepHoursLastNight` are considered, so it's silent until the
 *  per-session health capture has accrued enough data. */
export function detectSleep(sessions: Session[]): PatternItem | null {
  const rested: number[] = [];
  const short: number[] = [];
  for (const s of sessions) {
    if (typeof s.sleepHoursLastNight !== 'number') continue;
    (s.sleepHoursLastNight >= REST_THRESHOLD_HOURS ? rested : short).push(sessionImprovement(s));
  }
  const obs = Math.min(rested.length, short.length);
  const rMean = mean(rested);
  const sMean = mean(short);
  const effect = Math.abs(rMean - sMean);
  const tier = classifyTier(obs, MIN_OBS_PER_BUCKET, effect, EFFECT_GRAY, EFFECT_STRONG);
  if (tier === 'none') return null;

  const restedBetter = rMean >= sMean;
  const text =
    tier === 'finding'
      ? restedBetter
        ? 'You get more out of your sessions after a fuller night of sleep.'
        : 'Your sessions have been landing better on less sleep — worth a look.'
      : restedBetter
        ? 'A fuller night of sleep might be helping your sessions — worth watching?'
        : 'Shorter nights might be tracking with better sessions — odd, worth noticing?';
  return { id: 'sleep', text, kind: tier };
}

/** Below this many sessions the "noticed" empty-state shows a countdown;
 *  at/above it (with the engine still finding nothing) it shows the honest
 *  "still listening" line. 8 matches the pattern engine's finding-confidence
 *  comparison pool, so the countdown ends right when a finding can first fire. */
export const NOTICED_COUNTDOWN_THRESHOLD = 8;

export type NoticedEmptyState =
  | { stage: 'countdown'; remaining: number }
  | { stage: 'listening' };

/** What the insights "WHAT I'VE NOTICED" section should show when there are no
 *  visible patterns. Returns null when patterns exist (render the cards). Pure. */
export function noticedEmptyState(
  sessionCount: number,
  hasVisiblePatterns: boolean,
): NoticedEmptyState | null {
  if (hasVisiblePatterns) return null;
  if (sessionCount < NOTICED_COUNTDOWN_THRESHOLD) {
    return { stage: 'countdown', remaining: NOTICED_COUNTDOWN_THRESHOLD - sessionCount };
  }
  return { stage: 'listening' };
}

/** The public engine: run every signal, drop the silent ones, and order
 *  confident findings ahead of hedged questions (the insights UI renders them
 *  in this order; the free-teaser pick is the UI's concern, not the engine's).
 *  A fourth detector (sleep/steps) is added in the per-session-health plan. */
export function buildPatterns(sessions: Session[]): PatternItem[] {
  const detected = [
    detectTimeOfDay(sessions),
    detectDayOfWeek(sessions),
    detectConsistency(sessions),
    detectSleep(sessions),
  ].filter((x): x is PatternItem => x !== null);

  const findings = detected.filter((i) => i.kind === 'finding');
  const questions = detected.filter((i) => i.kind === 'question');
  return [...findings, ...questions];
}
