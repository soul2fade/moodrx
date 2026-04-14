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

  // Text
  text: '#ffffff',
  textSecondary: '#c8c8c8',
  textMuted: '#d4d4d4',
  textSubtle: '#a3a3a3',
  textDim: '#525252',
  textGhost: '#262626',
  textDimmer: '#737373',
  textDark: '#3a3a3a',

  // Semantic
  success: '#059669',
  warning: '#D97706',
  danger: '#E11D48',
  info: '#5EAAB5',
  premium: '#E8B84B',

  // Overlay
  backdrop: 'rgba(0,0,0,0.6)',
} as const;
