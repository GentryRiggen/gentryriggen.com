import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Route } from "react-router-dom";

import {
  View,
} from 'lib/components';

import BlogPost from 'domains/blog/screens/BlogPost';
import Blog from 'domains/blog/screens/Blog';

export class Router extends PureComponent {
  static propTypes = {
    match: PropTypes.object.isRequired,
  }

  render() {
    const { match } = this.props;
    return (
      <View
        m="0 auto"
        pt={[1, 3, 4]}
        pr={[1, 3, 4]}
        pl={[1, 3, 4]}
      >
        <Route
          path={`${match.path}/:id`}
          component={BlogPost}
        />
        <Route
          exact
          path={match.path}
          component={Blog}
        />
      </View>
    );
  }
}

export default Router;
