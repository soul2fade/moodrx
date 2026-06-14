import type { MoodKey, Session, SessionHealthFields } from '@/lib/storage';

export type Risk = 'none' | 'elevated' | 'acute';

export interface VentAssessment {
  mood: MoodKey;
  intensity: number; // 1–10
  reply: string;
  risk: Risk;
}

// MUST match lib/storage MoodKey and the vent-line function's MOOD_KEYS.
const MOODS: MoodKey[] = ['anxious', 'low', 'foggy', 'restless', 'stressed', 'good'];
const RISKS: Risk[] = ['none', 'elevated', 'acute'];

/** Validate/normalize the vent-line JSON response. Returns null on any shape
 *  error so callers fall back to the mood form. (vent-line already validates
 *  server-side; this guards the client against a malformed/changed payload.) */
export function parseVentResponse(raw: unknown): VentAssessment | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const reply = typeof o.reply === 'string' ? o.reply.trim() : '';
  if (typeof o.mood !== 'string' || !MOODS.includes(o.mood as MoodKey)) return null;
  if (typeof o.intensity !== 'number' || !Number.isFinite(o.intensity)) return null;
  if (typeof o.risk !== 'string' || !RISKS.includes(o.risk as Risk)) return null;
  if (reply.length === 0) return null;
  const intensity = Math.min(10, Math.max(1, Math.round(o.intensity)));
  return { mood: o.mood as MoodKey, intensity, reply, risk: o.risk as Risk };
}

/** Join two transcript fragments with exactly one space, trimming each. Either
 *  side may be empty (returns the other). Used to stitch continuous-STT segments. */
export function joinTranscript(a: string, b: string): string {
  const left = a.trim();
  const right = b.trim();
  if (!left) return right;
  if (!right) return left;
  return `${left} ${right}`;
}

/** Accumulate a continuous-STT transcript across segments.
 *  `committed` holds all finalized segments so far; `segment` is the latest
 *  recognizer result (interim or final). The on-screen `display` is always
 *  committed + current segment; a segment only folds into `committed` once it
 *  is `isFinal`. This is what prevents a natural pause (which finalizes the
 *  prior segment and resets results[0] for the next) from erasing earlier text. */
export function accumulateTranscript(
  committed: string,
  segment: string,
  isFinal: boolean,
): { committed: string; display: string } {
  const display = joinTranscript(committed, segment);
  return { committed: isFinal ? display : committed, display };
}

/** Length of the shared case-insensitive leading prefix of `a` and `b`. */
function commonPrefixLen(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a.charAt(i).toLowerCase() === b.charAt(i).toLowerCase()) i++;
  return i;
}

/** Whether `cur` looks like a NEW utterance rather than a continuation of
 *  `prev`. Streaming interims for one phrase grow while sharing a long common
 *  prefix; when the on-device recognizer resets its interim at a pause, the next
 *  interim is a different phrase that diverges early. We treat <60% shared prefix
 *  (of the shorter string) as a reset. Pure. */
export function isInterimReset(prev: string, cur: string): boolean {
  const p = prev.trim();
  const c = cur.trim();
  if (!p || !c) return false;
  const shared = commonPrefixLen(p, c);
  return shared < 0.6 * Math.min(p.length, c.length);
}

/** Reset-aware transcript accumulator for continuous:false STT.
 *
 *  The on-device (Android SODA) recognizer overwrites its interim result at a
 *  mid-sentence pause, and its single FINAL result only carries the LAST phrase
 *  — so an accumulator that only commits on `isFinal` silently drops everything
 *  said before the pause (a crisis-safety hazard: "I want to kill myself, I
 *  can't take it anymore" arrived as just "I can't take it anymore").
 *
 *  This locks each phrase into `committed` the moment a reset is detected, so no
 *  spoken phrase is lost. `prevInterim` is the latest interim of the phrase still
 *  in progress. Returns the next {committed, prevInterim, display}. Pure. */
export function foldInterim(
  committed: string,
  prevInterim: string,
  segment: string,
  isFinal: boolean,
): { committed: string; prevInterim: string; display: string } {
  const seg = segment.trim();
  if (isFinal) {
    // Final for the current phrase. If it diverges from the tracked interim (a
    // reset that went straight to final), lock the prior phrase in first.
    const base = prevInterim && isInterimReset(prevInterim, seg)
      ? joinTranscript(committed, prevInterim)
      : committed;
    const next = joinTranscript(base, seg);
    return { committed: next, prevInterim: '', display: next };
  }
  if (prevInterim && isInterimReset(prevInterim, seg)) {
    // New phrase started — the previous interim is a completed phrase; commit it.
    const next = joinTranscript(committed, prevInterim);
    return { committed: next, prevInterim: seg, display: joinTranscript(next, seg) };
  }
  // First interim, or the same phrase still growing/being revised.
  return { committed, prevInterim: seg, display: joinTranscript(committed, seg) };
}

/** Decide whether to run STT on-device or fall back to cloud. On-device is
 *  preferred (privacy: audio never leaves the phone); we fall back to cloud only
 *  when the platform can't do on-device for this locale. Pure — the caller
 *  supplies the platform capability values it queried. */
export function pickRecognitionMode(input: {
  supportsOnDevice: boolean;
  onDeviceLocales: string[];
  locale: string;
}): { requiresOnDeviceRecognition: boolean; usingCloud: boolean } {
  const lang = input.locale.slice(0, 2).toLowerCase();
  const hasLocale = input.onDeviceLocales.some((l) => l.slice(0, 2).toLowerCase() === lang);
  const onDevice = input.supportsOnDevice && hasLocale;
  return { requiresOnDeviceRecognition: onDevice, usingCloud: !onDevice };
}

/** Decide what to do on each speech-recognition `end` event. Venting emulates
 *  continuous listening with single-utterance (`continuous:false`) recognition —
 *  the mode that works on Android's on-device SODA recognizer without the
 *  mid-stream-close race that `continuous:true` triggers (the recognizer's read
 *  is interrupted by a stop()/close() from another thread, dropping the result).
 *
 *  While the user hasn't ended the session, a natural end (end of an utterance or
 *  a pause) means "keep listening" → restart recognition, accumulating across
 *  utterances. Once the user ends it (taps DONE, or silence auto-finish / hard-
 *  stop fires), finalize: submit if anything was captured, else fall back to the
 *  manual mood form. Pure. */
export function nextRecognitionStep(input: {
  userEnded: boolean;
  hasTranscript: boolean;
}): 'restart' | 'submit' | 'fallback' {
  if (!input.userEnded) return 'restart';
  return input.hasTranscript ? 'submit' : 'fallback';
}

export type VentAction = 'reply' | 'reply-with-resource' | 'crisis-redirect';

/** Graded crisis routing: only 'acute' takes over to the crisis screen;
 *  'elevated' shows a warm reply with a small inline resource; 'none' is a
 *  normal reply. (The reply tone itself is set by the model server-side.) */
export function ventAction(risk: Risk): VentAction {
  if (risk === 'acute') return 'crisis-redirect';
  if (risk === 'elevated') return 'reply-with-resource';
  return 'reply';
}

/** The workout-less check-in a completed vent persists. Mirrors the quick-log
 *  shape (postScore = intensity, lightDay, duration 0) so it doesn't distort
 *  improvement stats, and tags source:'vent'. Pure — caller supplies id,
 *  timestamp, and optional captured health fields. */
export function buildVentSession(args: {
  id: string;
  mood: MoodKey;
  intensity: number;
  timestamp: number;
  health?: SessionHealthFields;
}): Session {
  return {
    id: args.id,
    mood: args.mood,
    intensity: args.intensity,
    postScore: args.intensity,
    workoutName: 'Vent',
    duration: 0,
    timestamp: args.timestamp,
    lightDay: true,
    source: 'vent',
    ...(args.health ?? {}),
  };
}
