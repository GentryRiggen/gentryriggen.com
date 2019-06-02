import { HTMLAttributes } from 'react'
import styled from 'styled-components'
import * as SS from 'styled-system'
import * as CSS from 'csstype'

import { flexibleStyle } from 'lib/components/View'
import colors from 'lib/styles/colors'
import {
  textOverflowStyle,
  userSelect,
  wordBreak,
  whiteSpace,
} from 'lib/components/Text'

export const textStyle = SS.variant({
  key: 'textStyles',
})

export interface IHtmlSpanElementProps
  extends HTMLAttributes<HTMLSpanElement> {}
interface IBaseProps
  extends IHtmlSpanElementProps,
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

type IProps = IVariantProps & IBaseProps

// prettier-ignore
const Span = styled.span<IProps>`
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

Span.displayName = 'Span'
Span.defaultProps = { variant: 'text' }

export default Span
