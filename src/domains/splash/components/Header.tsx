import React from 'react'

import View from 'lib/components/View'
import Image from 'lib/components/Image'
import Text from 'lib/components/Text'

export const Header = () => {
  return (
    <View animation="fadeInDown" flexible="row-space-between" height={[64, 86]}>
      <View flexible="row-v-center">
        <Image
          src="images/MultiColorLogo.png"
          width={[32, 50]}
          height={[32, 50]}
        />
        <Text fontSize={[18, 24]} fontWeight={700} ml={[2, 3]}>
          gentry
        </Text>
      </View>
    </View>
  )
}

export default Header
