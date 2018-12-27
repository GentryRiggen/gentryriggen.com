import React, { PureComponent } from 'react';

import {
  Flex,
  Icon,
  Image,
  Text,
  Title,
} from 'lib/components';

export class AboutMe extends PureComponent {
  renderLink = (link, icon) => (
    <a href={link} target="_blank" rel="noopener noreferrer">
      <Icon className={icon} fontSize="title" />
    </a>
  )

  render() {
    return (
      <Flex
        flexDirection="column"
        alignItems="center"
        justifyContent="flex-start"
        pt={['sm', 'lg', 'xl']}
        pr={['sm', 'lg', 'xl']}
        pl={['sm', 'lg', 'xl']}
      >
        <Flex
          flexDirection={['column', 'column', 'row']}
          flexWrap="wrap"
          alignItems="center"
          maxWidth="md"
        >
          <Flex
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
            <Title textAlign="center" pt="md">Hi, I'm Gentry.</Title>
          </Flex>
          <Flex
            flexDirection="column"
            maxWidth={400}
            m="md"
          >
            <Text textAlign="center">
              I am a software developer in the mobile (React Native - iOS &amp; Android) and web space.
              My current vices are React, React Native, Node and Firebase. I have also done plenty of PHP, Angular, and MySQL.
            </Text>
            <Flex
              flexDirection="row"
              justifyContent="space-around"
              pt="lg"
            >
              {this.renderLink('https://twitter.com/gentryriggen', 'fab fa-twitter')}
              {this.renderLink('https://github.com/gentryriggen', 'fab fa-github')}
              {this.renderLink('https://www.linkedin.com/in/GentryRiggen', 'fab fa-linkedin-in')}
              {this.renderLink('https://stackoverflow.com/users/1767285/gentryriggen', 'fab fa-stack-overflow')}
            </Flex>
          </Flex>
        </Flex>
      </Flex>
    );
  }
}

export default AboutMe;
