import { HTMLAttributes } from 'react'
import styled from 'styled-components'
import * as SS from 'styled-system'
import * as CSS from 'csstype'

import { flexibleStyle } from 'lib/components/View'
import colors from 'lib/styles/colors'

export const textStyle = SS.variant({
  key: 'textStyles',
})

export const fontSizes = {
  captionSmall: 10,
  caption: 12,
  text: 14,
  subtitle: 18,
  title: 22,
  jumbo: 36,
}
export const fontWeights = {
  captionSmall: 400,
  caption: 400,
  text: 400,
  subtitle: 400,
  title: 700,
  jumbo: 700,
}
export const lineHeights = {
  captionSmall: '12px',
  caption: '16px',
  text: '16px',
  subtitle: '18px',
  title: '28px',
  jumbo: '44px',
}
export const textStyles = {
  'caption-small': {
    fontSize: fontSizes.captionSmall,
    lineHeight: lineHeights.captionSmall,
  },
  caption: {
    fontSize: fontSizes.caption,
    lineHeight: lineHeights.caption,
  },
  text: {
    fontSize: fontSizes.text,
    lineHeight: lineHeights.text,
  },
  subtitle: {
    fontSize: fontSizes.subtitle,
    lineHeight: lineHeights.subtitle,
  },
  title: {
    fontSize: fontSizes.title,
    lineHeight: lineHeights.title,
    fontWeight: 700,
  },
  jumbo: {
    fontSize: fontSizes.jumbo,
    lineHeight: lineHeights.jumbo,
    fontWeight: 700,
  },
  navLink: {
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.subtitle,
    lineHeight: lineHeights.subtitle,
    color: '#fff',
  },
  formError: {
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.caption,
    lineHeight: lineHeights.caption,
    color: colors.error,
  },
}

export const textOverflowStyle = SS.variant({
  key: 'textOverflowStyles',
  prop: 'overflow',
})

export const textOverflowStyles = {
  ellipsis: {
    'white-space': 'nowrap',
    overflow: 'hidden',
    'text-overflow': 'ellipsis',
  },
}

export const wordBreak = SS.style({
  prop: 'wordBreak',
  cssProperty: 'wordBreak',
})

export const userSelect = SS.style({
  prop: 'userSelect',
  cssProperty: 'userSelect',
})

export const whiteSpace = SS.style({
  prop: 'whiteSpace',
  cssProperty: 'whiteSpace',
})

export interface IHtmlParagraphElementProps
  extends HTMLAttributes<HTMLParagraphElement> {}
interface IBaseProps
  extends IHtmlParagraphElementProps,
    SS.AlignContentProps,
    SS.AlignItemsProps,
    SS.AlignSelfProps,
    SS.BackgroundColorProps,
    SS.BorderColorProps,
    SS.BorderProps,
    SS.BorderRadiusProps,
    SS.BordersProps,
    SS.BottomProps,
    SS.ColorProps,
    SS.DisplayProps,
    SS.FlexBasisProps,
    SS.FlexDirectionProps,
    SS.FlexProps,
    SS.FlexWrapProps,
    SS.FontSizeProps,
    SS.FontStyleProps,
    SS.FontWeightProps,
    SS.GridAutoFlowProps,
    SS.GridColumnGapProps,
    SS.GridRowGapProps,
    SS.GridTemplateColumnsProps,
    SS.GridTemplateRowsProps,
    SS.HeightProps,
    SS.JustifyContentProps,
    SS.JustifySelfProps,
    SS.LeftProps,
    SS.LineHeightProps,
    SS.MaxHeightProps,
    SS.MaxWidthProps,
    SS.MinHeightProps,
    SS.MinWidthProps,
    SS.OrderProps,
    SS.OverflowProps,
    SS.PositionProps,
    SS.RightProps,
    SS.SpaceProps,
    SS.TextAlignProps,
    SS.TopProps,
    SS.VerticalAlignProps,
    SS.WidthProps,
    SS.ZIndexProps {
  color?: CSS.ColorProperty
  flexible?: string
  variant?: string
  wordBreak?: string
  whiteSpace?: string
  userSelect?: string
}

interface IVariantProps {
  variant?:
    | 'caption-small'
    | 'caption'
    | 'text'
    | 'subtitle'
    | 'title'
    | 'jumbo'
    | 'navLink'
    | 'formError'
}

type ITextProps = IVariantProps & IBaseProps

// prettier-ignore
const Text = styled.p<ITextProps>`
  color: ${colors.text}
  ${textStyle}
  ${textOverflowStyle}
  ${flexibleStyle}
  ${userSelect}
  ${wordBreak}
  ${whiteSpace}

  ${SS.alignContent}
  ${SS.alignItems}
  ${SS.alignSelf}
  ${SS.bottom}
  ${SS.color}
  ${SS.display}
  ${SS.flexBasis}
  ${SS.flexDirection}
  ${SS.flexWrap}
  ${SS.flex}
  ${SS.fontSize}
  ${SS.fontStyle}
  ${SS.fontWeight}
  ${SS.height}
  ${SS.justifyContent}
  ${SS.justifySelf}
  ${SS.left}
  ${SS.letterSpacing}
  ${SS.lineHeight}
  ${SS.maxHeight}
  ${SS.maxWidth}
  ${SS.minHeight}
  ${SS.minWidth}
  ${SS.order}
  ${SS.position}
  ${SS.right}
  ${SS.space}
  ${SS.textAlign}
  ${SS.top}
  ${SS.verticalAlign}
  ${SS.width}
  ${SS.zIndex}
`

Text.displayName = 'Text'
Text.defaultProps = { variant: 'text' }

export default Text
