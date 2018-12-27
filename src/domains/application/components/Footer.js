import React, { PureComponent } from 'react';
import { Link } from 'react-router-dom';

import {
  Flex,
  Text,
  Subtitle,
} from 'lib/components';
import BehindFeature from 'domains/features/components/BehindFeature';

export class Footer extends PureComponent {
  renderLink = (to, label) => (
    <Link to={to}>
      <Text p="md">{label}</Text>
    </Link>
  )

  render() {
    return (
      <Flex
        flexDirection="column"
        justifyContent="center"
        alignItems="Center"
        pt="xl"
        pb="md"
      >
        <Subtitle>GentryRiggen.com</Subtitle>
        <Flex
          flexDirection="row"
          justifyContent="center"
          alignItems="Center"
        >
          {this.renderLink('/', 'Home')}
          <BehindFeature
            feature="blog"
            on={this.renderLink('/blog', 'Blog')}
          />
        </Flex>
      </Flex>
    );
  }
}

export default Footer;
