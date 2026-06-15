/** Centralized color palette — single source of truth for the app's visual tokens */

export const colors = {
  // Backgrounds
  bg: '#0a0a0a',
  surface: '#111111',
  surfaceDark: '#0d0d0d',
  surfaceDim: '#0f0f0f',

  // Borders
  border: '#1a1a1a',
  borderMedium: '#333333',
  borderLight: '#222222',

  // Text — keep LIGHT for legibility on the near-black bg (see readability-standard).
  // The dim trio below (textDim/textGhost/textDark) is for BORDERS/dividers ONLY,
  // never text.
  text: '#ffffff',
  textSecondary: '#d8d8d8',
  textMuted: '#e2e2e2',
  textSubtle: '#cfcfcf',
  textDim: '#525252',
  textGhost: '#262626',
  textDimmer: '#999999',
  textDark: '#3a3a3a',

  // Semantic
  accent: '#10B981',   // brand/chrome accent (emerald)
  success: '#059669',  // positive state / health metric (distinct from accent)
  warning: '#D97706',
  danger: '#E11D48',
  info: '#5EAAB5',
  premium: '#E8B84B',

  // Pricing-tier accents (used only by the pricing comparison). Mirror the mood
  // palette: Own it = foggy blue, MoodRx+ = good green, Free = plain white.
  tierFree: '#ffffff',
  tierOwn: '#5EAAB5',   // === colors.info / mood 'foggy'
  tierPlus: '#059669',  // === colors.success / mood 'good'

  // Overlay
  backdrop: 'rgba(0,0,0,0.6)',
} as const;
