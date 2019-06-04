import React, { useState, useEffect } from 'react'

import View from 'lib/components/View'
import Image from 'lib/components/Image'
import Text from 'lib/components/Text'
import Span from 'lib/components/Span'
import Header from 'domains/splash/components/Header'
import { GetInTouch } from 'domains/splash/components/GetInTouch'
import AnimateOnChange from 'lib/components/AnimateOnChange'

const technolgies = [
  'React 🎉',
  'React-Native 🤩',
  'Node 😃',
  'Passion 💪',
  'GraphQL 😘',
  'Firebase 👍',
  'Love 😍',
  'MySQL 😎',
  'Angular 😪',
  'PHP 🤬',
]
const colors = ['primary', 'secondary', 'tertiary', '#2dc5ee']

const getTechRandomIndex = (index: number) =>
  index === technolgies.length - 1 ? 0 : index + 1

const titleProps = {
  fontSize: [32, 48, 72],
  lineHeight: ['54px', '84px'],
}

export const SplashScreen = () => {
  const [techIndex, setTechIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setTechIndex(getTechRandomIndex(techIndex))
    }, 2700)

    return () => {
      clearInterval(interval)
    }
  })

  const renderTech = () => (
    <AnimateOnChange animationIn="slideIn" animationOut="slideOut" ml={2}>
      <Span
        fontSize={[18, 32]}
        fontWeight={700}
        color={colors[techIndex % colors.length]}
      >
        {technolgies[techIndex]}
      </Span>
    </AnimateOnChange>
  )

  const renderInterest = (interest: string) => (
    <Text
      color="textLight"
      fontSize={[14, 16, 18]}
      fontWeight={600}
      lineHeight={'28px'}
    >
      {interest}
    </Text>
  )

  return (
    <View variant="screen" id="splash-screen">
      <Header />

      <Image
        animationDelay={500}
        src="images/Header.jpg"
        alt="Profile Header Image for Gentry"
        height="auto"
        width="100%"
        noSpinner={true}
      />

      <View
        mt={[2, 4]}
        mb={[64, 128]}
        display="grid"
        gridTemplateColumns={['auto', '1fr 1fr']}
        gridColumnGap="28px"
        boxSizing="border-box"
        px={[0, 4]}
      >
        <View animation="fadeIn" animationDelay={1000}>
          <Text {...titleProps}>Hi 👋,</Text>
          <Text {...titleProps}>
            I'm{' '}
            <Span {...titleProps} fontWeight={700}>
              Gentry
            </Span>
          </Text>
        </View>

        <View
          animation="fadeIn"
          animationDelay={1250}
          mt={[2, 24]}
          ml={[0, 24]}
        >
          <View flexible="row-v-center">
            <Text fontSize={[14, 18, 20]} fontWeight={600} lineHeight={'24px'}>
              I develop apps with
            </Text>
            {renderTech()}
          </View>

          <Text
            mt={3}
            fontSize={[14, 16, 18]}
            fontWeight={600}
            lineHeight={'28px'}
          >
            Besides software engineering...
          </Text>
          {renderInterest('I have a beautiful wife👰, baby boy 👶, and dog 🐶')}
          {renderInterest("I'm a total gym rat (crossfit and bro lifting 💪)")}
          {renderInterest("I'm a sci-fi and fantasy book nerd 🤓")}
        </View>
      </View>

      <GetInTouch />
    </View>
  )
}

export default SplashScreen
