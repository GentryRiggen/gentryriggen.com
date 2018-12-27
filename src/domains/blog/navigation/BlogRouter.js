import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Route } from "react-router-dom";

import {
  Flex,
} from 'lib/components';

import BlogPost from 'domains/blog/screens/BlogPost';
import Blog from 'domains/blog/screens/Blog';

export class BlogRouter extends PureComponent {
  static propTypes = {
    match: PropTypes.object.isRequired,
  }

  render() {
    const { match } = this.props;
    return (
      <Flex
      >
        <Route
          exact
          path={match.path}
          component={Blog}
        />
        <Route
          path={`${match.path}/:id`}
          component={BlogPost}
        />
      </Flex>
    );
  }
}

export default BlogRouter;
