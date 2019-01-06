import React, { PureComponent } from 'react';

import {
  FlyIn,
  View,
  Image,
  Text,
} from 'lib/components';
import trackAboutAnalytics from 'domains/about/trackAboutAnalytics';

export class AboutMe extends PureComponent {
  componentDidMount() {
    trackAboutAnalytics('Viewed About Me');
  }

  renderLink = (link, icon, direction) => (
    <FlyIn type={direction}>
      <a href={link} target="_blank" rel="noopener noreferrer">
        <Text className={icon} textStyle="title" />
      </a>
    </FlyIn>
  )

  render() {
    return (
      <View
        flexStyle="vertical-center"
        data-test="about-me"
      >
        <Image
          src="images/profile.jpg"
          width={250}
          height={250}
          borderRadius="50%"
          alt="Gentry Riggen"
        />
        <Text
          textStyle="title"
          textAlign="center"
          p="lg"
        >
          Hi, I'm Gentry.
        </Text>

        <Text textAlign="center">
          I'm a full-stack software engineer developing websites and mobile apps with React, React Native, Node and Firebase.
          In the past I have done lots of PHP, Angular, and MySQL.
          Check out my work or hit me up on any of the platforms below <span role="img" aria-label="muscle fire">🔥💪</span>.
        </Text>
        <View
          flexStyle="horizontal"
          justifyContent="space-around"
          pt="lg"
          width="100%"
        >
          {this.renderLink(
            'https://twitter.com/gentryriggen',
            'fab fa-twitter',
            FlyIn.FLY_IN_LEFT,
          )}
          {this.renderLink(
            'https://github.com/gentryriggen',
            'fab fa-github',
            FlyIn.FLY_IN_BOTTOM_LEFT,
          )}
          {this.renderLink(
            'https://www.linkedin.com/in/GentryRiggen',
            'fab fa-linkedin-in',
            FlyIn.FLY_IN_BOTTOM_RIGHT,
          )}
          {this.renderLink(
            'https://stackoverflow.com/users/1767285/gentryriggen',
            'fab fa-stack-overflow',
            FlyIn.FLY_IN_RIGHT,
          )}
        </View>
      </View>
    );
  }
}

export default AboutMe;
