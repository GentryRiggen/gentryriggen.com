import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { connect } from 'react-redux';
import { createStructuredSelector } from 'reselect';

import {
  View,
  Text,
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
      <View
        flexStyle="vertical-center"
        pt="xl"
        pb="md"
        data-test="footer"
      >
        <Text textStyle="subtitle">GentryRiggen.com</Text>
        <View
          flexStyle="horizontal-center"
        >
          {this.renderLink('/', 'Home')}
          <BehindFeature
            feature="blog"
            on={this.renderLink('/blog', 'Blog')}
          />
          {isLoggedIn && (
            <Text p="md" onClick={logout}>Logout</Text>
          )}
        </View>
      </View>
    );
  }
}

export default connect(mapState)(Footer);
