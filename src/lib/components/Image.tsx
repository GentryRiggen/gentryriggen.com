import React, { HTMLAttributes, useState } from 'react'
import * as CSS from 'csstype'
import styled from 'styled-components'
import * as SS from 'styled-system'
import View, { AnimationType } from 'lib/components/View'
import Spinner from 'lib/components/Spinner'

export interface IHtmlImgElementProps
  extends HTMLAttributes<HTMLImageElement> {}
export interface IProps
  extends IHtmlImgElementProps,
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
  'data-test'?: string
}

const Img = styled.img<IProps>`
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

Img.displayName = 'Img'

interface IImageProps extends IProps {
  animation?: AnimationType
  animationDelay?: number
  noSpinner?: boolean
  src: string
  alt: string
}

export default function(props: IImageProps) {
  const [loaded, setLoaded] = useState(false)

  const onLoaded = () => setLoaded(true)

  const {
    animation = 'popIn',
    animationDelay = 0,
    src,
    alt,
    noSpinner = false,
    ...rest
  } = props
  if (!loaded) {
    return (
      <View {...rest}>
        <View flexible="column-center">
          {!noSpinner && <Spinner />}
          <Img src={src} onLoad={onLoaded} style={{ visibility: 'hidden' }} />
        </View>
      </View>
    )
  }
  return (
    <View {...rest} animation={animation} animationDelay={animationDelay}>
      <Img height="100%" width="100%" src={src} alt={alt} />
    </View>
  )
}
