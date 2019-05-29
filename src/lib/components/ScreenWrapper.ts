import styled from 'styled-components'

const ScreenWrapper = styled.div`
  ${props => props.theme.animations.show};
  animation-delay: 200ms;
  opacity: 0;
`

ScreenWrapper.displayName = 'ScreenWrapper'

export default ScreenWrapper
