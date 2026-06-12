/** The three severity tiers, matching the trash-talk severity slider:
 *  "I'm in a glass house" (light) / "Sticks and Stones" (normal) / "Roast me"
 *  (intense). Text generation + human review are per-tier and voice-independent;
 *  the voice phase fans each tier's approved lines across every configured voice. */
export interface Tier {
  /** Stable key used in file paths, the manifest, and the app. */
  key: 'glass-house' | 'sticks' | 'roast';
  /** Human-facing slider label (text-only, no emojis — per brand). */
  label: string;
  /** Persona/intensity guidance injected into the generation prompt. */
  guidance: string;
}

export const TIERS: Tier[] = [
  {
    key: 'glass-house',
    label: "I'm in a glass house",
    guidance:
      'Gentle ribbing. Soft, affectionate teasing about their reluctance to work out — the kind you would aim at a friend you like. Never sharp, never about their body or worth.',
  },
  {
    key: 'sticks',
    label: 'Sticks and Stones',
    guidance:
      'Standard Dr. MoodRx bite. Deadpan, film-noir, confidently sarcastic about their excuses and resistance. Funny first, mean never — still about the workout, not the person.',
  },
  {
    key: 'roast',
    label: 'Roast me',
    guidance:
      'Sharper and funnier, dialed up — but still LIGHTHEARTED and affectionate underneath. Rib their excuses hard; never cruel about their body, weight, intelligence, or worth.',
  },
];

export const TIER_KEYS = TIERS.map((t) => t.key) as Tier['key'][];

export function isTierKey(s: string): s is Tier['key'] {
  return (TIER_KEYS as string[]).includes(s);
}
