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
