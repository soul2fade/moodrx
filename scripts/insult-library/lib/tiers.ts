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
      'Lightest burn. Keep the yo-mama exaggeration gentle and silly rather than savage — the absurd payoff should make them grin, not sting. For someone who might feel fragile today, so tease the effort softly.',
  },
  {
    key: 'sticks',
    label: 'Sticks and Stones',
    guidance:
      'Standard setting. The everyday playful jab — clearly teasing, a little cheeky, confident. The default amount of poke.',
  },
  {
    key: 'roast',
    label: 'Roast me',
    guidance:
      'Sharpest, HARD-R setting. Profanity (fuck, shit, ass, bitch, damn) is welcome. Be brutally savage about their effort, coordination, weakness, stamina, and form — the savagery comes from the absurd comparison, not from shock. Stay affectionate underneath; never cruel about their body, weight, looks, intelligence, or worth.',
  },
];

export const TIER_KEYS = TIERS.map((t) => t.key) as Tier['key'][];

export function isTierKey(s: string): s is Tier['key'] {
  return (TIER_KEYS as string[]).includes(s);
}
