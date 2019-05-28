import React from 'react'
import View from 'lib/components/View'
import Image from 'lib/components/Image'
import Text from 'lib/components/Text'

export const SplashScreen = () => {
  const renderSocialLink = (link: string, icon: string, color: string) => (
    <View mx={[2, 3]}>
      <a href={link} target="_blank" rel="noopener noreferrer">
        <Text className={icon} fontSize={[32, 48]} color={color} />
      </a>
    </View>
  )

  return (
    <View width="100%">
      <View maxWidth={1440} margin="0 auto" boxSizing="border-box" p={[2, 3]}>
        <View flexible="row-space-between" width="100%" mb={3}>
          <View flexible="row-v-center">
            <Image
              src="images/MultiColorLogo.png"
              // @ts-ignore
              width={[32, 50]}
              // @ts-ignore
              height={[32, 50]}
            />
            <Text fontSize={[18, 24]} fontWeight={700} ml={[2, 3]}>
              gentry
            </Text>
          </View>
        </View>
        <Image src="images/header.png" height="auto" width="100%" />

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
              I'm a full-stack software engineer specializing in website and mobile
              development with React, React Native, Node, GraphQL, and Firebase. In the
              past I have done lots of PHP, Angular, and MySQL. Check out my
              work or hit me up on any of the platforms below 🔥💪.
            </Text>
          </View>
        </View>

        <View mt={128} flexible="column-h-center" width="100%">
          <View flexible="row-v-center">
            {renderSocialLink(
              'https://twitter.com/gentryriggen',
              'fab fa-twitter',
              '#27b1e8',
            )}
            {renderSocialLink(
              'https://www.instagram.com/gentrycodes/',
              'fab fa-instagram',
              '#e1345f',
            )}
            {renderSocialLink(
              'https://github.com/gentryriggen',
              'fab fa-github',
              '#2d264e',
            )}
            {renderSocialLink(
              'https://www.linkedin.com/in/GentryRiggen',
              'fab fa-linkedin-in',
              '#0d75b5',
            )}
            {renderSocialLink(
              'https://stackoverflow.com/users/1767285/gentryriggen',
              'fab fa-stack-overflow',
              '#f17507',
            )}
          </View>
        </View>
      </View>
    </View>
  )
}

export default SplashScreen
