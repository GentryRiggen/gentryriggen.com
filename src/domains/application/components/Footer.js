import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { connect } from 'react-redux';
import { createStructuredSelector } from 'reselect';

import {
  Flex,
  Text,
  Subtitle,
} from 'lib/components';

import BehindFeature from 'domains/features/components/BehindFeature';
import { logout } from 'domains/admin/awaits/logout';
import { isLoggedInSelector } from 'domains/admin/selectors/admin';

const mapState = createStructuredSelector({
  isLoggedIn: isLoggedInSelector,
});

export class Footer extends PureComponent {
  static propTypes = {
    isLoggedIn: PropTypes.bool.isRequired,
  }

  renderLink = (to, label) => (
    <Link to={to}>
      <Text p="md">{label}</Text>
    </Link>
  )

  render() {
    const { isLoggedIn } = this.props;

    return (
      <Flex
        flex="0 1 auto"
        flexDirection="column"
        justifyContent="center"
        alignItems="Center"
        pt="xl"
        pb="md"
        data-test="footer"
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
          {isLoggedIn && (
            <Text p="md" onClick={logout}>Logout</Text>
          )}
        </Flex>
      </Flex>
    );
  }
}

export default connect(mapState)(Footer);
