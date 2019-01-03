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

const displayFlex = {
  display: 'flex',
};
const flexCenter = {
  alignItems: 'center',
  justifyContent: 'center',
};

const fontSizes = {
  caption: 14,
  text: 18,
  subtitle: 24,
  title: 36,
  jumbo: 48,
};
const fontWeights = {
  caption: 400,
  text: 400,
  subtitle: 700,
  title: 700,
  jumbo: 700,
};
const lineHeights = {
  caption: 1.7,
  text: 1.7,
  subtitle: 1.7,
  title: 1.7,
  jumbo: 1.5,
};

export const theme = {
  breakpoints: [
    SMALL_SCREEN,
    MEDIUM_SCREEN,
    LARGE_SCREEN,
  ],
  space,
  fontSizes,
  fontWeights,
  lineHeights,
  textStyles: {
    caption: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.caption,
      lineHeight: lineHeights.caption,
      color: colors.text,
    },
    text: {
      fontSize: fontSizes.text,
      fontWeight: fontWeights.text,
      lineHeight: lineHeights.text,
      color: colors.text,
    },
    subtitle: {
      fontSize: fontSizes.subtitle,
      fontWeight: fontWeights.subtitle,
      lineHeight: lineHeights.subtitle,
      color: colors.text,
    },
    title: {
      fontSize: fontSizes.title,
      fontWeight: fontWeights.title,
      lineHeight: lineHeights.title,
      color: colors.text,
    },
    jumbo: {
      fontSize: fontSizes.jumbo,
      fontWeight: fontWeights.jumbo,
      lineHeight: lineHeights.jumbo,
      color: colors.text,
    },
  },
  flexStyles: {
    vertical: {
      ...displayFlex,
      flexDirection: 'column',
    },
    'vertical-center': {
      ...displayFlex,
      ...flexCenter,
      flexDirection: 'column',
    },
    horizontal: {
      ...displayFlex,
      flexDirection: 'row',
    },
    'horizontal-center': {
      ...displayFlex,
      ...flexCenter,
      flexDirection: 'row',
    },
  },
  width: [16, 32, 64, 128, 256],
  minWidths: {
    sm: SMALL_SCREEN - 34,
    md: MEDIUM_SCREEN - 34,
    lg: LARGE_SCREEN - 34,
  },
  maxWidths: {
    sm: SMALL_SCREEN - 34,
    md: MEDIUM_SCREEN - 34,
    lg: LARGE_SCREEN - 34,
  },
  colors: {
    primary: colors.primary,
    text: colors.text,
  },
};
