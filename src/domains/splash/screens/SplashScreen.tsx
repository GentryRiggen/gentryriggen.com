import React from 'react'

import View from 'lib/components/View'
import Image from 'lib/components/Image'
import Text from 'lib/components/Text'
import Header from 'domains/splash/components/Header'
import { GetInTouch } from 'domains/splash/components/GetInTouch'

export const SplashScreen = () => {
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
      >
        <View animation="fadeIn" animationDelay={1000} mb={[3, 0]} ml={[0, 4]}>
          <Text
            fontSize={[48, 72]}
            fontWeight={700}
            lineHeight={['54px', '84px']}
            textAlign={['center', 'left']}
          >
            Hi, I'm Gentry
          </Text>
        </View>

        <View
          animation="fadeIn"
          animationDelay={1250}
          flex={1}
          mt={2}
          mr={[0, 4]}
        >
          <Text
            color="textLight"
            fontSize={18}
            fontWeight={600}
            lineHeight={'24px'}
            textAlign={['center', 'left']}
          >
            I'm a full-stack software engineer specializing in website and
            mobile development with React, React Native, Node, GraphQL,
            Firebase, PHP, Angular, and MySQL. In my free time I like to lift
            💪🔥🍕
          </Text>
        </View>
      </View>

      <GetInTouch />
    </View>
  )
}

export default SplashScreen
