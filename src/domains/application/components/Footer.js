import React, { PureComponent } from 'react';
import { Link } from 'react-router-dom';

import {
  View,
  Text,
  Subtitle,
} from 'lib/components';

export class Footer extends PureComponent {
  renderLink = (to, label) => (
    <Link to={to}>
      <Text p="md">{label}</Text>
    </Link>
  )

  render() {
    return (
      <View
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="Center"
        pt="xl"
        pb="md"
      >
        <Subtitle>GentryRiggen.com</Subtitle>
        <View
          display="flex"
          flexDirection="row"
          justifyContent="center"
          alignItems="Center"
        >
          {this.renderLink('/', 'Home')}
          {this.renderLink('/blog', 'Blog')}
        </View>
      </View>
    );
  }
}

export default Footer;
