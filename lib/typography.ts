import { Platform } from 'react-native';

export const fonts = {
  primary: {
    light: 'SpaceGrotesk_300Light',
    regular: 'SpaceGrotesk_400Regular',
    bold: 'SpaceGrotesk_700Bold',
  },
  mono: {
    regular: Platform.select({ ios: 'Courier New', android: 'monospace', default: 'monospace' }) as string,
  },
};

export const type = {
  // PRIMARY — human voice
  headline: { fontFamily: fonts.primary.bold, fontSize: 28, color: '#ffffff', letterSpacing: 0 },
  headlineMd: { fontFamily: fonts.primary.bold, fontSize: 22, color: '#ffffff', letterSpacing: 0 },
  headlineSm: { fontFamily: fonts.primary.bold, fontSize: 18, color: '#ffffff', letterSpacing: 0 },
  body: { fontFamily: fonts.primary.regular, fontSize: 15, color: '#ffffff', lineHeight: 22 },
  bodyMuted: { fontFamily: fonts.primary.regular, fontSize: 15, color: '#a3a3a3', lineHeight: 22 },
  bodySm: { fontFamily: fonts.primary.regular, fontSize: 13, color: '#a3a3a3', lineHeight: 19 },
  soft: { fontFamily: fonts.primary.light, fontSize: 15, color: '#a3a3a3', lineHeight: 22 },
  softMuted: { fontFamily: fonts.primary.light, fontSize: 13, color: '#737373', lineHeight: 19 },
  button: { fontFamily: fonts.primary.bold, fontSize: 14, color: '#ffffff', letterSpacing: 2, textTransform: 'uppercase' as const },
  buttonLg: { fontFamily: fonts.primary.bold, fontSize: 16, color: '#ffffff', letterSpacing: 2, textTransform: 'uppercase' as const },

  // MONO — system voice
  label: { fontFamily: fonts.mono.regular, fontSize: 11, color: '#a3a3a3', letterSpacing: 3.5, textTransform: 'uppercase' as const },
  labelBright: { fontFamily: fonts.mono.regular, fontSize: 11, color: '#ffffff', letterSpacing: 3.5, textTransform: 'uppercase' as const },
  labelLg: { fontFamily: fonts.mono.regular, fontSize: 13, color: '#a3a3a3', letterSpacing: 3, textTransform: 'uppercase' as const },
  code: { fontFamily: fonts.mono.regular, fontSize: 12, color: '#a3a3a3', letterSpacing: 3, textTransform: 'uppercase' as const },
  codeBright: { fontFamily: fonts.mono.regular, fontSize: 14, color: '#ffffff', letterSpacing: 3, textTransform: 'uppercase' as const },
  step: { fontFamily: fonts.mono.regular, fontSize: 11, color: '#a3a3a3', letterSpacing: 3, textTransform: 'uppercase' as const },
  timer: { fontFamily: fonts.mono.regular, fontSize: 13, color: '#ffffff', letterSpacing: 2, textTransform: 'uppercase' as const },
  number: { fontFamily: fonts.mono.regular, fontSize: 13, color: '#a3a3a3', letterSpacing: 1 },
  timestamp: { fontFamily: fonts.mono.regular, fontSize: 11, color: '#737373', letterSpacing: 2, textTransform: 'uppercase' as const },
  dataLabel: { fontFamily: fonts.mono.regular, fontSize: 11, color: '#a3a3a3', letterSpacing: 2, textTransform: 'uppercase' as const },
  dataValue: { fontFamily: fonts.primary.bold, fontSize: 24, color: '#ffffff' },
};