import React, { useLayoutEffect, useState, useRef } from 'react'
import View, { IViewProps, AnimationType } from 'lib/components/View'

interface IProps extends IViewProps {
  animationIn: AnimationType
  animationOut: AnimationType
  children: any
  durationOut?: number
}

const AnimateOnChange = (props: IProps) => {
  const {
    animationIn,
    animationOut,
    children,
    durationOut = 200,
    ...rest
  } = props
  const [animation, setAnimation] = useState('')
  const [displayContent, setDisplayContent] = useState(children)

  useLayoutEffect(() => {
    setAnimation('out')
    const inTimeout = setTimeout(() => {
      setAnimation('in')
      setDisplayContent(children)
    }, durationOut)

    return () => {
      clearTimeout(inTimeout)
    }
  }, [children])

  const isComingIn = animation === 'in'
  return (
    <View animation={isComingIn ? animationIn : animationOut} {...rest}>
      {displayContent}
    </View>
  )
}

AnimateOnChange.displayName = 'AnimateOnChange'

export default AnimateOnChange
