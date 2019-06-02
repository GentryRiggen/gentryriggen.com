import * as CSS from 'csstype'
import { HTMLAttributes } from 'react'
import styled from 'styled-components'
import * as SS from 'styled-system'
import { animations } from 'lib/styles/animations'

export const variantStyle = SS.variant({ key: 'viewVariantStyles' })
export const viewVariantStyles = {
  paper: {
    backgroundColor: '#fff',
    borderRadius: '6px',
    boxShadow: '0 0 24px rgba(0,0,0,0.12)',
    maxWidth: '100%',
    overflow: 'hidden',
    padding: '32px',
  },
  screen: `
    ${animations.fadeIn};
    opacity: 0;
    padding: 16px;
    max-width: 1350px;
    margin: 0 auto;
  `,
}

const animationDelay = SS.style({
  prop: 'animationDelay',
  cssProperty: 'animationDelay',
  transformValue: (n: number) => `${n}ms`,
})

export const animationStyle = SS.variant({
  key: 'animationStyles',
  prop: 'animation',
})

export type AnimationOptions =
  | 'fadeIn'
  | 'fadeInUp'
  | 'fadeInDown'
  | 'fadeOut'
  | 'popIn'
export const animationStyles = {
  fadeIn: animations.fadeIn,
  fadeInUp: animations.fadeInUp,
  fadeOut: animations.fadeIn,
  fadeInDown: animations.fadeInDown,
  popIn: animations.popIn,
}

export const hoverStyle = SS.variant({
  key: 'viewHoverStyles',
  prop: 'hover',
})
export const elevationVariantStyle = SS.variant({
  key: 'elevationStyles',
  prop: 'elevation',
})

export const elevationStyles = {
  zero: {
    boxShadow: '0 0 24px rgba(0,0,0,0.12)',
  },
  one: {
    boxShadow: '0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23)',
  },
  two: {
    boxShadow: '0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23)',
  },
  three: {
    boxShadow: '0 14px 28px rgba(0,0,0,0.25), 0 10px 10px rgba(0,0,0,0.22)',
  },
  four: {
    boxShadow: '0 19px 38px rgba(0,0,0,0.30), 0 15px 12px rgba(0,0,0,0.22)',
  },
}

const overflowY = SS.style({
  prop: 'overflowY',
  cssProperty: 'overflowY',
})
const overflowX = SS.style({
  prop: 'overflowX',
  cssProperty: 'overflowX',
})
export const flexibleStyle = SS.variant({
  key: 'flexibleStyles',
  prop: 'flexible',
})
const displayFlex = {
  display: 'flex',
}
const flexCenter = {
  alignItems: 'center',
  justifyContent: 'center',
}
export enum flexibleOption {
  column,
  'column-center',
  'column-h-start',
  'column-h-end',
  'column-h-center',
  'column-v-end',
  'column-v-center',
  'column-space-between',
  row,
  'row-wrap',
  'row-center',
  'row-v-center',
  'row-v-end',
  'row-h-center',
  'row-h-end',
  'row-h-end-wrap',
  'row-space-between',
  'row-space-between-wrap',
  'row-space-around',
  'row-space-around-wrap',
}

export const flexibleStyles = {
  column: {
    ...displayFlex,
    flexDirection: 'column',
  },
  'column-center': {
    ...displayFlex,
    ...flexCenter,
    flexDirection: 'column',
  },
  'column-h-start': {
    ...displayFlex,
    alignItems: 'flex-start',
    flexDirection: 'column',
  },
  'column-h-end': {
    ...displayFlex,
    alignItems: 'flex-end',
    flexDirection: 'column',
  },
  'column-h-center': {
    ...displayFlex,
    flexDirection: 'column',
    alignItems: 'center',
  },
  'column-v-end': {
    ...displayFlex,
    flexDirection: 'column',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
  },
  'column-v-center': {
    ...displayFlex,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  'column-space-between': {
    ...displayFlex,
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  row: {
    ...displayFlex,
    flexDirection: 'row',
  },
  'row-wrap': {
    ...displayFlex,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  'row-center': {
    ...displayFlex,
    ...flexCenter,
    flexDirection: 'row',
  },
  'row-v-center': {
    ...displayFlex,
    justifyContent: 'flex-start',
    alignItems: 'center',
    flexDirection: 'row',
  },
  'row-v-end': {
    ...displayFlex,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    flexDirection: 'row',
  },
  'row-h-center': {
    ...displayFlex,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  'row-h-end': {
    ...displayFlex,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  'row-h-end-wrap': {
    ...displayFlex,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  'row-space-between': {
    ...displayFlex,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  'row-space-between-wrap': {
    ...displayFlex,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  'row-space-around': {
    ...displayFlex,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  'row-space-around-wrap': {
    ...displayFlex,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
}
export const cursorStyle = SS.style({
  prop: 'cursor',
  cssProperty: 'cursor',
})
export const boxSizing = SS.style({
  prop: 'boxSizing',
  cssProperty: 'boxSizing',
})

export interface IHtmlDivElementProps extends HTMLAttributes<HTMLDivElement> {}
interface IBaseProps
  extends IHtmlDivElementProps,
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
  variant?: 'paper' | 'screen'
  animation?: AnimationOptions
  animationDelay?: number | string
  wordBreak?: string
  userSelect?: string
  hover?: string
  boxSizing?: string
  overflowY?: string
  overflowX?: string
  elevation?: string
  cursor?: string
  'data-test'?: string
}

export interface IFlexibleProps {
  flexible?:
    | 'column'
    | 'column-center'
    | 'column-h-start'
    | 'column-h-end'
    | 'column-h-center'
    | 'column-v-end'
    | 'column-v-center'
    | 'column-space-between'
    | 'row'
    | 'row-wrap'
    | 'row-center'
    | 'row-v-center'
    | 'row-v-end'
    | 'row-h-center'
    | 'row-h-end'
    | 'row-h-end-wrap'
    | 'row-space-between'
    | 'row-space-between-wrap'
    | 'row-space-around'
    | 'row-space-around-wrap'
    | string
}

interface IElevationProps {
  elevation?: 'zero' | 'one' | 'two' | 'three' | 'four'
}

export type IViewProps = IBaseProps & IFlexibleProps & IElevationProps

const View = styled.div<IViewProps>`
  ${flexibleStyle};
  ${variantStyle};
  ${animationStyle};
  ${animationDelay};
  ${hoverStyle};
  ${boxSizing};
  ${cursorStyle};
  ${elevationVariantStyle};
  ${overflowY};
  ${overflowX};

  ${SS.alignContent};
  ${SS.alignItems};
  ${SS.alignSelf};
  ${SS.borderColor};
  ${SS.borderRadius};
  ${SS.borders};
  ${SS.bottom};
  ${SS.color};
  ${SS.display};
  ${SS.flexBasis};
  ${SS.flexDirection};
  ${SS.flexWrap};
  ${SS.flex};
  ${SS.fontSize};
  ${SS.fontWeight};
  ${SS.gridAutoFlow};
  ${SS.gridColumnGap};
  ${SS.gridRowGap};
  ${SS.gridTemplateColumns};
  ${SS.gridTemplateRows}
  ${SS.height};
  ${SS.justifyContent};
  ${SS.justifySelf};
  ${SS.left};
  ${SS.lineHeight};
  ${SS.maxHeight};
  ${SS.maxWidth};
  ${SS.minHeight};
  ${SS.minWidth};
  ${SS.order};
  ${SS.overflow};
  ${SS.position};
  ${SS.right};
  ${SS.space};
  ${SS.top};
  ${SS.verticalAlign};
  ${SS.width};
  ${SS.zIndex};
`

View.displayName = 'View'

export default View
