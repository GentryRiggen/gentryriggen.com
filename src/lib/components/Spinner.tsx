import styled, { keyframes } from 'styled-components'
import React from 'react'
import colors, { ColorOptions } from 'lib/styles/colors'

const BounceAnimation = keyframes`
  0% { margin-bottom: 0; }
  50% { margin-bottom: 15px }
  100% { margin-bottom: 0 }
`

const DotWrapper = styled.div`
  display: flex;
  align-items: flex-end;
  width: 60px;
  height: 60px;
`

interface IDotProps {
  delay?: string
  color?: string
}
const Dot = styled.div<IDotProps>`
  background-color: ${props => props.color || colors.primary};
  border-radius: 50%;
  width: 10px;
  height: 10px;
  margin: 0 5px;
  /* Animation */
  animation: ${BounceAnimation} 0.5s linear infinite;
  animation-delay: ${props => props.delay};
`

interface IProps {
  color?: ColorOptions
}

export const Spinner = (props: IProps) => {
  return (
    <DotWrapper>
      <Dot delay="0s" color={props.color} />
      <Dot delay=".1s" color={props.color} />
      <Dot delay=".2s" color={props.color} />
    </DotWrapper>
  )
}

export default Spinner
