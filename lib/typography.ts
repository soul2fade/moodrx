export const fonts = {
  primary: {
    light: 'SpaceGrotesk_300Light',
    regular: 'SpaceGrotesk_400Regular',
    bold: 'SpaceGrotesk_700Bold',
  },
  mono: {
    regular: 'BarlowCondensed_400Regular',
    bold: 'BarlowCondensed_700Bold',
  },
};

// ─── READABILITY STANDARD (do not regress — see memory `readability-standard`) ──
// Text greys must stay LIGHT (≥ ~#cfcfcf on the #0a0a0a bg). Never use the
// near-black greys (#525252/#3a3a3a/#262626) for TEXT — borders/dividers only.
// Small uppercase mono labels: keep size ≥ 16 and letter-spacing ≤ ~1.5 so they
// aren't "small AND tightly grouped." Screens must use these tokens, not
// hardcoded greys (a lint guard enforces it).
export const type = {
  // PRIMARY — human voice
  headline:    { fontFamily: fonts.primary.bold,    fontSize: 33, color: '#ffffff', letterSpacing: 0, lineHeight: 40 },
  headlineMd:  { fontFamily: fonts.primary.bold,    fontSize: 27, color: '#ffffff', letterSpacing: 0, lineHeight: 34 },
  headlineSm:  { fontFamily: fonts.primary.bold,    fontSize: 22, color: '#ffffff', letterSpacing: 0, lineHeight: 28 },
  body:        { fontFamily: fonts.primary.regular, fontSize: 18, color: '#ffffff', lineHeight: 27 },
  bodyMuted:   { fontFamily: fonts.primary.regular, fontSize: 18, color: '#e2e2e2', lineHeight: 26 },
  bodySm:      { fontFamily: fonts.primary.regular, fontSize: 17, color: '#dcdcdc', lineHeight: 24 },
  soft:        { fontFamily: fonts.primary.regular, fontSize: 17, color: '#dcdcdc', lineHeight: 25 },
  softMuted:   { fontFamily: fonts.primary.regular, fontSize: 16, color: '#cfcfcf', lineHeight: 23 },
  button:      { fontFamily: fonts.primary.bold,    fontSize: 16, color: '#ffffff', letterSpacing: 2, lineHeight: 22, textTransform: 'uppercase' as const },
  buttonLg:    { fontFamily: fonts.primary.bold,    fontSize: 18, color: '#ffffff', letterSpacing: 2, lineHeight: 24, textTransform: 'uppercase' as const },

  // BARLOW CONDENSED — system voice
  label:     { fontFamily: fonts.mono.regular, fontSize: 16, color: '#dcdcdc', letterSpacing: 1.5,  lineHeight: 22, textTransform: 'uppercase' as const },
  labelBright: { fontFamily: fonts.mono.regular, fontSize: 16, color: '#ffffff', letterSpacing: 1.5,  lineHeight: 22, textTransform: 'uppercase' as const },
  labelLg:   { fontFamily: fonts.mono.regular, fontSize: 17, color: '#dcdcdc', letterSpacing: 1.25, lineHeight: 23, textTransform: 'uppercase' as const },
  code:      { fontFamily: fonts.mono.regular, fontSize: 16, color: '#d0d0d0', letterSpacing: 1.25, lineHeight: 22, textTransform: 'uppercase' as const },
  codeBright:{ fontFamily: fonts.mono.regular, fontSize: 17, color: '#ffffff', letterSpacing: 1.25, lineHeight: 22, textTransform: 'uppercase' as const },
  step:      { fontFamily: fonts.mono.regular, fontSize: 16, color: '#d0d0d0', letterSpacing: 1.25, lineHeight: 22, textTransform: 'uppercase' as const },
  timer:     { fontFamily: fonts.mono.bold,    fontSize: 18, color: '#ffffff', letterSpacing: 1.5,  lineHeight: 23, textTransform: 'uppercase' as const },
  number:    { fontFamily: fonts.mono.regular, fontSize: 17, color: '#dcdcdc', letterSpacing: 1,    lineHeight: 22 },
  timestamp: { fontFamily: fonts.mono.regular, fontSize: 16, color: '#cfcfcf', letterSpacing: 1,    lineHeight: 21, textTransform: 'uppercase' as const },
  dataLabel: { fontFamily: fonts.mono.regular, fontSize: 16, color: '#dcdcdc', letterSpacing: 1,    lineHeight: 21, textTransform: 'uppercase' as const },
  dataValue: { fontFamily: fonts.primary.bold, fontSize: 27, color: '#ffffff',                      lineHeight: 34 },
};
