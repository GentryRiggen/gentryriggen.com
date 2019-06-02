import React from 'react'

import View from 'lib/components/View'
import Text from 'lib/components/Text'
import SocialLink from 'domains/splash/components/SocialLink'

export const GetInTouch = () => {
  return (
    <View
      animation="fadeInUp"
      animationDelay={1500}
      flexible="column-h-center"
      px={3}
      height="100%"
      mt={[64, 128]}
    >
      <View
        display="flex"
        flexDirection="column"
        justifyContent="space-between"
        alignContent="center"
        height="100%"
        maxWidth={304}
      >
        <View width="100%" flexible="column-center">
          <Text textAlign="center" variant="subtitle" fontWeight={700}>
            Get in touch / See my work
          </Text>
        </View>
        <View flexible="row-center" height={64}>
          <SocialLink
            link="https://twitter.com/gentryriggen"
            icon="fab fa-twitter"
            color="#27b1e8"
          />
          <SocialLink
            link="https://www.instagram.com/gentrycodes/"
            icon="fab fa-instagram"
            color="#e1345f"
          />
          <SocialLink
            link="https://github.com/gentryriggen"
            icon="fab fa-github"
            color="#2d264e"
          />
          <SocialLink
            link="https://www.linkedin.com/in/GentryRiggen"
            icon="fab fa-linkedin-in"
            color="#0d75b5"
          />
          <SocialLink
            link="https://stackoverflow.com/users/1767285/gentryriggen"
            icon="fab fa-stack-overflow"
            color="#f17507"
          />
        </View>
      </View>
    </View>
  )
}

export default GetInTouch
