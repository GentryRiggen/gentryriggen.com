import React from 'react'
import { HideUntilLoaded } from 'react-animation'

import View from 'lib/components/View'
import Image from 'lib/components/Image'
import Text from 'lib/components/Text'
import Header from 'domains/splash/components/Header'
import ScreenWrapper from 'lib/components/ScreenWrapper'
import Spinner from 'lib/components/Spinner'

export const SplashScreen = () => {
  return (
    <ScreenWrapper>
      <Header />

      <HideUntilLoaded
        animationIn="bounceIn"
        imageToLoad="images/header.png"
        Spinner={Spinner}
      >
        <Image src="images/header.png" height="auto" width="100%" />
      </HideUntilLoaded>

      <View
        mt={4}
        width="100%"
        display="flex"
        flexDirection={['column', 'row']}
      >
        <View flex={1} ml={[0, 64]}>
          <Text
            fontSize={[48, 72]}
            fontWeight={700}
            lineHeight={['54px', '84px']}
            mb={[3, 0]}
          >
            Hi, I'm Gentry
          </Text>
        </View>

        <View flex={1} mt={2} mr={[0, 64]}>
          <Text
            color="textLight"
            fontSize={18}
            fontWeight={600}
            lineHeight={'24px'}
          >
            I'm a full-stack software engineer specializing in website and
            mobile development with React, React Native, Node, GraphQL,
            Firebase, PHP, Angular, and MySQL. In my free time I like to lift
            💪🔥🍕
          </Text>
        </View>
      </View>
    </ScreenWrapper>
  )
}

export default SplashScreen
