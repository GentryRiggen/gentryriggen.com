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
    >
      <View flexible="column-center">
        <Text textAlign="center" variant="subtitle" fontWeight={700}>
          Get in touch / See my work
        </Text>
      </View>
      <View flexible="row-center" mt={3} height={64}>
        <SocialLink
          name="Twitter Profile"
          link="https://twitter.com/gentryriggen"
          icon="fab fa-twitter"
          color="#27b1e8"
        />
        <SocialLink
          name="Instagram Profile"
          link="https://www.instagram.com/gentrycodes/"
          icon="fab fa-instagram"
          color="#e1345f"
        />
        <SocialLink
          name="Github Profile"
          link="https://github.com/gentryriggen"
          icon="fab fa-github"
          color="#2d264e"
        />
        <SocialLink
          name="LinkedIn Profile"
          link="https://www.linkedin.com/in/GentryRiggen"
          icon="fab fa-linkedin-in"
          color="#0d75b5"
        />
        <SocialLink
          name="Stack Overflow Profile"
          link="https://stackoverflow.com/users/1767285/gentryriggen"
          icon="fab fa-stack-overflow"
          color="#f17507"
        />
      </View>
    </View>
  )
}

export default GetInTouch
