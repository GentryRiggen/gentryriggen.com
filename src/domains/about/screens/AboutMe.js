import React, { PureComponent } from 'react';

import {
  Icon,
  Image,
  Text,
  Title,
  View,
} from 'lib/components';

export class AboutMe extends PureComponent {
  renderLink = (link, icon) => (
    <a href={link} target="_blank" rel="noopener noreferrer">
      <Icon className={icon} fontSize="title" />
    </a>
  )

  render() {
    return (
      <View
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        pt={['sm', 'lg', 'xl']}
        pr={['sm', 'lg', 'xl']}
        pl={['sm', 'lg', 'xl']}
      >
        <View
          display="flex"
          flexDirection={['column', 'column', 'row']}
          flexWrap="wrap"
          alignItems="center"
          maxWidth="md"
        >
          <View
            display="flex"
            flexDirection="column"
            m="md"
          >
            <Image
              src="images/profile.jpg"
              width={250}
              height={250}
              borderRadius="50%"
              alt="Gentry Riggen"
            />
            <Title>Hi, I'm Gentry.</Title>
          </View>
          <View
            display="flex"
            flexDirection="column"
            maxWidth="sm"
            m="md"
          >
            <Text>
              I am a software developer in the mobile (React Native - iOS &amp; Android) and web space.
              My current vices are React, React Native, Node and Firebase. I have also done plenty of PHP, Angular, and MySQL.
            </Text>
            <View
              display="flex"
              flexDirection="row"
              justifyContent="space-around"
              pt="md"
            >
              {this.renderLink('https://twitter.com/gentryriggen', 'fab fa-twitter')}
              {this.renderLink('https://github.com/gentryriggen', 'fab fa-github')}
              {this.renderLink('https://www.linkedin.com/in/GentryRiggen', 'fab fa-linkedin-in')}
              {this.renderLink('https://stackoverflow.com/users/1767285/gentryriggen', 'fab fa-stack-overflow')}
            </View>
          </View>
        </View>
      </View>
    );
  }
}

export default AboutMe;
