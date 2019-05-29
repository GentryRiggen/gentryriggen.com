import React from 'react'
import { HideUntilLoaded } from 'react-animation'

import View from 'lib/components/View'
import Image from 'lib/components/Image'
import Text from 'lib/components/Text'
import Spinner from 'lib/components/Spinner'

export const Header = () => {
  return (
    <View flexible="row-space-between" height={86}>
      <View flexible="row-v-center">
        <HideUntilLoaded
          animationIn="bounceIn"
          imageToLoad="images/MultiColorLogo.png"
          Spinner={Spinner}
        >
          <Image
            src="images/MultiColorLogo.png"
            // @ts-ignore
            width={[32, 50]}
            // @ts-ignore
            height={[32, 50]}
          />
        </HideUntilLoaded>
        <Text fontSize={[18, 24]} fontWeight={700} ml={[2, 3]}>
          gentry
        </Text>
      </View>
    </View>
  )
}

export default Header
