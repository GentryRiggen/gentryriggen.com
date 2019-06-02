import React, { useState, useEffect } from 'react'

import View from 'lib/components/View'
import Image from 'lib/components/Image'
import Text from 'lib/components/Text'
import Span from 'lib/components/Span'
import Header from 'domains/splash/components/Header'
import { GetInTouch } from 'domains/splash/components/GetInTouch'
import AnimateOnChange from 'lib/components/AnimateOnChange'
import { color } from 'styled-system'

const technolgies = [
  'React 🎉',
  'Passion 💪',
  'React-Native 🤩',
  'Node 😃',
  'GraphQL 😘',
  'Love 😍',
  'Firebase 👍',
  'Angular 😪',
  'MySQL 😎',
  'PHP 🤬',
]
const colors = ['primary', 'secondary', 'tertiary']

const getTechRandomIndex = (index: number) =>
  index === technolgies.length - 1 ? 0 : index + 1

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
        fontSize={32}
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
      fontSize={14}
      fontWeight={600}
      lineHeight={'24px'}
    >
      {interest}
    </Text>
  )

  return (
    <View variant="screen">
      <Header />

      <Image
        animationDelay={500}
        src="images/Header.jpg"
        height="auto"
        width="100%"
        noSpinner={true}
      />
      <View
        mt={4}
        display="grid"
        gridTemplateColumns={['auto', '1fr 1fr']}
        gridColumnGap="28px"
        width="100%"
        mx={[0, 3]}
      >
        <View animation="fadeIn" animationDelay={1000} mb={[3, 0]}>
          <Text
            fontSize={[48, 72]}
            fontWeight={700}
            lineHeight={['54px', '84px']}
          >
            Hi, I'm Gentry
          </Text>
        </View>

        <View animation="fadeIn" animationDelay={1250} flex={1} mt={24}>
          <View flexible="row-v-center">
            <Text fontSize={18} fontWeight={600} lineHeight={'24px'}>
              I develop apps with
            </Text>
            {renderTech()}
          </View>

          <Text mt={3} fontSize={14} fontWeight={600} lineHeight={'24px'}>
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
