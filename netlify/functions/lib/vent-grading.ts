export type Risk = 'none' | 'elevated' | 'acute';

/** Narrow, high-precision self-harm phrasings. Multi-word and specific on
 *  purpose — single words like "kill"/"die" are excluded because they fire on
 *  hyperbole ("this traffic is killing me"). A bare phrase raises the floor to
 *  'elevated' (resource link); paired with a method/imminence signal below it
 *  forces 'acute' (the hard crisis redirect). */
const SELF_HARM_PHRASES = [
  'kill myself',
  'killing myself',
  'end my life',
  'ending my life',
  "don't want to be alive",
  'do not want to be alive',
  "don't want to live",
  'take my own life',
  'taking my own life',
];

/** Method, plan, or imminence signals. On their own these are innocuous
 *  ("a plan", "tonight", "bridge") — they ONLY escalate when they co-occur with
 *  a self-harm phrase above. The conjunction is what keeps hyperbole ("I'd kill
 *  myself before that meeting") at 'elevated' rather than forcing a redirect.
 *  Plan phrasings are affirmative ("i have a plan", not bare "a plan") so the
 *  negation "i don't have a plan" doesn't falsely trip the net. */
const IMMINENCE_OR_METHOD = [
  // imminence / timing
  'tonight', 'right now', 'tomorrow',
  // concrete method
  'pills', 'overdose', 'gun', 'shoot myself', 'rope', 'hang myself',
  'hanging myself', 'noose', 'jump off', 'jump from', 'off a bridge',
  'off the bridge', 'slit', 'my wrists', 'razor blade', 'bleed out',
  'carbon monoxide',
  // plan / preparation
  'i have a plan', 'have a way', 'going to do it', 'wrote a note',
  'suicide note', 'left a note', 'said goodbye', 'saying goodbye',
];

/** Deterministic keyword backstop for the model's risk grade. 'acute' when a
 *  self-harm phrase co-occurs with a method/imminence signal; 'elevated' on a
 *  self-harm phrase alone; otherwise 'none'. It only ever RAISES the model's
 *  grade (see resolveRisk), never lowers it. */
export function classifyKeywordFloor(transcript: string): Risk {
  const t = transcript.toLowerCase();
  if (!SELF_HARM_PHRASES.some((p) => t.includes(p))) return 'none';
  return IMMINENCE_OR_METHOD.some((m) => t.includes(m)) ? 'acute' : 'elevated';
}

const RANK: Record<Risk, number> = { none: 0, elevated: 1, acute: 2 };

/** Combine the model's grade with the keyword backstop, taking the HIGHER of
 *  the two. The model's 'acute' always stands; the keyword net can raise an
 *  under-flagged grade up to 'elevated' (phrase) or 'acute' (phrase + plan). */
export function resolveRisk(modelRisk: Risk, keywordFloor: Risk): Risk {
  return RANK[modelRisk] >= RANK[keywordFloor] ? modelRisk : keywordFloor;
}

// Canonical mood keys — MUST match lib/moods.ts MOOD_ORDER in the app.
export const MOOD_KEYS = ['anxious', 'low', 'foggy', 'restless', 'stressed', 'good'] as const;
export type MoodKey = (typeof MOOD_KEYS)[number];

export interface Assessment {
  mood: MoodKey;
  intensity: number; // 1–10
  reply: string;
  risk: Risk;
}

const RISKS: Risk[] = ['none', 'elevated', 'acute'];

export function validateAssessment(raw: unknown): Assessment | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const mood = o.mood;
  const intensityRaw = o.intensity;
  const reply = typeof o.reply === 'string' ? o.reply.trim() : '';
  const risk = o.risk;

  if (typeof mood !== 'string' || !MOOD_KEYS.includes(mood as MoodKey)) return null;
  if (typeof intensityRaw !== 'number' || !Number.isFinite(intensityRaw)) return null;
  const intensity = Math.round(intensityRaw);
  if (intensity < 1 || intensity > 10) return null;
  if (reply.length === 0) return null;
  if (typeof risk !== 'string' || !RISKS.includes(risk as Risk)) return null;

  return { mood: mood as MoodKey, intensity, reply, risk: risk as Risk };
}

export const ASSESS_TOOL = {
  name: 'record_assessment',
  description: "Record the user's inferred mood, intensity, a short in-character reply, and a crisis-risk tier.",
  input_schema: {
    type: 'object' as const,
    properties: {
      mood: { type: 'string', enum: [...MOOD_KEYS], description: 'Best-fit mood for what the user described.' },
      intensity: { type: 'integer', minimum: 1, maximum: 10, description: 'How intense the state is, 1 (mild) to 10 (overwhelming).' },
      reply: { type: 'string', description: '1-2 sentence in-character Dr. MoodRx reply. Tone scales with risk (see system).' },
      risk: { type: 'string', enum: ['none', 'elevated', 'acute'], description: 'Crisis tier (see system prompt definitions).' },
    },
    required: ['mood', 'intensity', 'reply', 'risk'],
    additionalProperties: false,
  },
};

export const VENT_SYSTEM_PROMPT = `You are Dr. MoodRx, a darkly funny but ultimately caring fitness-for-mental-health coach with a film-noir, deadpan voice. The user just spoke for ~20 seconds about how they feel. From their words ONLY, do four things via the record_assessment tool.

1. mood: pick the single best-fit from: anxious, low, foggy, restless, stressed, good.
2. intensity: 1 (mild) to 10 (overwhelming).
3. risk — grade carefully; this gates the user experience:
   - "none": ordinary venting — frustration, anger, sadness, hyperbole, profanity, "I hate my job", "I'm so done". This is the DEFAULT. Hyperbole like "this is killing me" or "I could die" is NOT crisis.
   - "elevated": heavy distress with NO self-harm intent — hopelessness, "what's the point", crying, overwhelmed beyond venting.
   - "acute": genuine self-harm or suicidal ideation/intent. Reserve for real risk, not figures of speech.
   When unsure between two tiers, choose the LOWER one — except never downgrade genuine self-harm intent.
4. reply: 1-2 sentences, in voice, using ONLY what they said.
   - risk "none": teasing/deadpan, rib their resistance, never their worth or body.
   - risk "elevated": drop the teasing entirely. Warm, plain, supportive. No jokes at their expense.
   - risk "acute": brief, warm, non-clinical. Acknowledge them; do not joke; do not give medical advice.
   - EVERY tier: never use violence, weapon, or self-harm imagery — no guns, shooting, knives, blades, hanging, jumping, "off yourself", "blow your brains out", "end it", "kill", etc. Not literally, not ironically, not as a metaphor. This is a mental-health app; that language can land hard even when meant lightly.

NEVER invent facts, numbers, or history. NEVER give clinical labels, diagnoses, or medical advice. NEVER put violence, weapons, or self-harm imagery in your reply — not even figuratively or as a joke. Use only what the user said.`;

/** Structured facts for one past episode, as sent by the client (mirrors the
 *  app's Episode shape; this module stays app-independent). */
export interface EpisodeFacts {
  mood: string;
  intensity: number; // part of the wire shape; not rendered in the memory line
  workoutName: string;
  helped: 'yes' | 'somewhat' | 'no';
  dayLabel: string;
  daysAgo: number;
}

function isEpisodeFacts(v: unknown): v is EpisodeFacts {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.workoutName === 'string' && o.workoutName.trim().length > 0 &&
    (o.helped === 'yes' || o.helped === 'somewhat' || o.helped === 'no') &&
    typeof o.dayLabel === 'string' && o.dayLabel.trim().length > 0 &&
    typeof o.daysAgo === 'number' && Number.isFinite(o.daysAgo)
  );
}

/** workoutName/dayLabel come from the user's session log over HTTP and are
 *  interpolated into the system prompt. Strip newlines/backticks and clamp
 *  length so a crafted value can't inject prompt structure or instructions. */
function sanitizeFact(s: string): string {
  return s.replace(/[\r\n`]+/g, ' ').trim().slice(0, 80);
}

function whenLabel(e: EpisodeFacts): string {
  if (e.daysAgo <= 0) return 'today';
  if (e.daysAgo === 1) return 'yesterday';
  return `${sanitizeFact(e.dayLabel)}, ${e.daysAgo} days ago`;
}

function helpedLabel(e: EpisodeFacts): string {
  return e.helped === 'yes' ? 'helped' : e.helped === 'no' ? "didn't help" : 'sort of helped';
}

/** Append a per-mood memory block + a strict reference rule to the base vent
 *  prompt. Only valid entries for known mood keys are rendered. Returns the
 *  unmodified base prompt when there are none. */
export function buildVentSystem(episodes?: Record<string, unknown> | null): string {
  const valid = Object.entries(episodes ?? {}).filter(
    ([mood, e]) => (MOOD_KEYS as readonly string[]).includes(mood) && isEpisodeFacts(e),
  ) as [MoodKey, EpisodeFacts][];
  if (valid.length === 0) return VENT_SYSTEM_PROMPT;

  const lines = valid.map(
    ([mood, e]) => `- ${mood}: ${whenLabel(e)}, they did "${sanitizeFact(e.workoutName)}" and it ${helpedLabel(e)}.`,
  );
  return `${VENT_SYSTEM_PROMPT}

MEMORY — real past sessions, one per mood:
${lines.join('\n')}
If (and only if) the mood you assign appears above and it naturally fits, you may briefly reference that specific past session in your reply, in voice. Never reference a memory for a different mood. Never reference a past session when the risk is elevated or acute — only at risk "none". Never invent a past session. Use only these facts.`;
}
