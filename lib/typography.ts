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

export const type = {
  // PRIMARY — human voice
  headline:    { fontFamily: fonts.primary.bold,    fontSize: 33, color: '#ffffff', letterSpacing: 0, lineHeight: 40 },
  headlineMd:  { fontFamily: fonts.primary.bold,    fontSize: 27, color: '#ffffff', letterSpacing: 0, lineHeight: 34 },
  headlineSm:  { fontFamily: fonts.primary.bold,    fontSize: 22, color: '#ffffff', letterSpacing: 0, lineHeight: 28 },
  body:        { fontFamily: fonts.primary.regular, fontSize: 18, color: '#ffffff', lineHeight: 26 },
  bodyMuted:   { fontFamily: fonts.primary.regular, fontSize: 17, color: '#d4d4d4', lineHeight: 25 },
  bodySm:      { fontFamily: fonts.primary.regular, fontSize: 16, color: '#c8c8c8', lineHeight: 23 },
  soft:        { fontFamily: fonts.primary.regular, fontSize: 16, color: '#c8c8c8', lineHeight: 24 },
  softMuted:   { fontFamily: fonts.primary.regular, fontSize: 15, color: '#b8b8b8', lineHeight: 22 },
  button:      { fontFamily: fonts.primary.bold,    fontSize: 16, color: '#ffffff', letterSpacing: 2, lineHeight: 22, textTransform: 'uppercase' as const },
  buttonLg:    { fontFamily: fonts.primary.bold,    fontSize: 18, color: '#ffffff', letterSpacing: 2, lineHeight: 24, textTransform: 'uppercase' as const },

  // BARLOW CONDENSED — system voice
  label:     { fontFamily: fonts.mono.regular, fontSize: 15, color: '#c0c0c0', letterSpacing: 2.5, lineHeight: 20, textTransform: 'uppercase' as const },
  labelBright: { fontFamily: fonts.mono.regular, fontSize: 15, color: '#ffffff', letterSpacing: 2.5, lineHeight: 20, textTransform: 'uppercase' as const },
  labelLg:   { fontFamily: fonts.mono.regular, fontSize: 16, color: '#c0c0c0', letterSpacing: 2,   lineHeight: 21, textTransform: 'uppercase' as const },
  code:      { fontFamily: fonts.mono.regular, fontSize: 15, color: '#b8b8b8', letterSpacing: 2,   lineHeight: 20, textTransform: 'uppercase' as const },
  codeBright:{ fontFamily: fonts.mono.regular, fontSize: 17, color: '#ffffff', letterSpacing: 2,   lineHeight: 22, textTransform: 'uppercase' as const },
  step:      { fontFamily: fonts.mono.regular, fontSize: 15, color: '#b8b8b8', letterSpacing: 2,   lineHeight: 20, textTransform: 'uppercase' as const },
  timer:     { fontFamily: fonts.mono.bold,    fontSize: 17, color: '#ffffff', letterSpacing: 1.5, lineHeight: 22, textTransform: 'uppercase' as const },
  number:    { fontFamily: fonts.mono.regular, fontSize: 17, color: '#c0c0c0', letterSpacing: 1,   lineHeight: 22 },
  timestamp: { fontFamily: fonts.mono.regular, fontSize: 15, color: '#a3a3a3', letterSpacing: 1.5, lineHeight: 20, textTransform: 'uppercase' as const },
  dataLabel: { fontFamily: fonts.mono.regular, fontSize: 15, color: '#c0c0c0', letterSpacing: 1.5, lineHeight: 20, textTransform: 'uppercase' as const },
  dataValue: { fontFamily: fonts.primary.bold, fontSize: 27, color: '#ffffff',                      lineHeight: 34 },
};
