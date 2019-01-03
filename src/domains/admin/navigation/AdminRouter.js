import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Route } from "react-router-dom";

import Admin from 'domains/admin/Screens/Admin';

export class AdminRouter extends PureComponent {
  static propTypes = {
    path: PropTypes.string.isRequired,
  }

  render() {
    const { path } = this.props;
    return (
      <React.Fragment>
        <Route
          exact
          path={path}
          component={Admin}
        />
      </React.Fragment>
    );
  }
}

export default AdminRouter;
