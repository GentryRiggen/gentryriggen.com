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
import { selectors } from 'domains/application/ducks/application';
import { logout } from 'domains/admin/awaits/logout';

const mapState = createStructuredSelector({
  loggedInUser: selectors.loggedInUser.get,
});

export class Footer extends PureComponent {
  static propTypes = {
    loggedInUser: PropTypes.any,
  }

  static defaultProps = {
    loggedInUser: null,
  }

  renderLink = (to, label) => (
    <Link to={to}>
      <Text p="md">{label}</Text>
    </Link>
  )

  render() {
    const { loggedInUser } = this.props;

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
          {!!loggedInUser && (
            <Text p="md" onClick={logout}>Logout</Text>
          )}
        </Flex>
      </Flex>
    );
  }
}

export default connect(mapState)(Footer);
