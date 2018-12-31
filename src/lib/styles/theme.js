import colors from 'lib/styles/colors';

const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 32,
  xl: 48,
};

const SMALL_SCREEN = 320;
const MEDIUM_SCREEN = 768;
const LARGE_SCREEN = 1024;

export const theme = {
  breakpoints: [
    SMALL_SCREEN,
    MEDIUM_SCREEN,
    LARGE_SCREEN,
  ],
  space,
  fontSizes: {
    caption: 14,
    text: 18,
    subtitle: 24,
    title: 36,
    jumbo: 48,
  },
  lineHeights: {
    caption: 1.7,
    text: 1.7,
    subtitle: 1.7,
    title: 1.7,
    jumbo: 1.5,
  },
  fontWeights: {
    caption: 400,
    text: 400,
    subtitle: 700,
    title: 700,
    jumbo: 700,
  },
  width: [16, 32, 64, 128, 256],
  minWidths: {
    sm: SMALL_SCREEN - 64,
    md: MEDIUM_SCREEN - 64,
    lg: LARGE_SCREEN - 64,
  },
  maxWidths: {
    sm: SMALL_SCREEN - 64,
    md: MEDIUM_SCREEN - 64,
    lg: LARGE_SCREEN - 64,
  },
  colors: {
    primary: colors.primary,
    text: 'rgb(70, 72, 85)',
  },
};
