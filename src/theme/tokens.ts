export const colors = {
  background: '#121317',
  surfaceLowest: '#0d0e12',
  surfaceLow: '#1a1b1f',
  surface: '#1e1f23',
  surfaceHigh: '#292a2e',
  surfaceHighest: '#343539',
  text: '#e3e2e7',
  textMuted: '#c5c9ac',
  outline: '#8f9378',
  outlineMuted: '#444932',
  lime: '#caf300',
  limeDim: '#b0d500',
  onLime: '#171e00',
  error: '#ffb4ab',
  errorContainer: '#93000a',
} as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  bold: 'Inter_700Bold',
  extraBold: 'Inter_800ExtraBold',
  data: 'JetBrainsMono_500Medium',
  dataBold: 'JetBrainsMono_600SemiBold',
} as const;

export const layout = {
  mobileMargin: 16,
  desktopMargin: 32,
  maxContentWidth: 760,
  radius: 4,
  largeRadius: 8,
  rowHeight: 64,
} as const;
