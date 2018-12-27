import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { createStructuredSelector } from 'reselect';
import {
  Route,
  Redirect,
} from "react-router-dom";

import {
  Title,
} from 'lib/components/Text';

import { selectors } from 'domains/application/ducks/application';

const mapState = createStructuredSelector({
  loggedInUser: selectors.loggedInUser.get,
});

export class AdminRoute extends PureComponent {
  static propTypes = {
    component: PropTypes.any.isRequired,
    location: PropTypes.any,
    loggedInUser: PropTypes.any,
  }

  static defultProps = {
    location: null,
    loggedInUser: null,
  }

  renderRoute = () => {
    const {
      component: Component,
      loggedInUser,
      location,
      ...rest
    } = this.props;

    if (loggedInUser === false) {
      console.log('AdminRoute: Not logged in', this.props);
      return <Redirect to={{ pathname: '/login', state: { from: location } }} />;
    }

    if (loggedInUser) {
      console.log('AdminRoute: User is logged in', this.props);
      return <Component {...rest} />;
    }

    console.log('AdminRoute: User status is unknown', this.props);
    return <Title>Checkin Authentication</Title>;
  }

  render() {
    const {
      component: Component,
      ...rest
    } = this.props;
    return <Route {...rest} render={this.renderRoute} />;
  }
}

export default connect(mapState)(AdminRoute);
