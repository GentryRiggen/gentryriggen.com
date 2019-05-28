import colors from 'lib/styles/colors'
import {
  elevationStyles,
  flexibleStyles,
  viewVariantStyles,
} from 'lib/components/View'
import {
  fontSizes,
  fontWeights,
  lineHeights,
  textStyles,
  textOverflowStyles,
} from 'lib/components/Text'

export default {
  backgroundColors: colors,
  breakpoints: [960, 1440, 1920, 2160],
  colors,
  space: [0, 4, 8, 16, 32, 64, 128, 256, 512],
  width: [16, 32, 64, 128, 256],

  // VIEW
  elevationStyles,
  flexibleStyles,
  viewVariantStyles,

  // TEXT
  fontSizes,
  fontWeights,
  lineHeights,
  textStyles,
  textOverflowStyles,
}
