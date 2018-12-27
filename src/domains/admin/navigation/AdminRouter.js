import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Route } from "react-router-dom";

import {
  View,
} from 'lib/components';
import Admin from 'domains/admin/Screens/Admin';

export class AdminRouter extends PureComponent {
  static propTypes = {
    path: PropTypes.string.isRequired,
  }

  render() {
    const { path } = this.props;
    return (
      <View
        pt={[1, 3, 4]}
        pr={[1, 3, 4]}
        pl={[1, 3, 4]}
        width="100%"
      >
        <Route
          exact
          path={path}
          component={Admin}
        />
      </View>
    );
  }
}

export default AdminRouter;
