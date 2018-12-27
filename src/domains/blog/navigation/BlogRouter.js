import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Route } from "react-router-dom";

import BlogPost from 'domains/blog/screens/BlogPost';
import Blog from 'domains/blog/screens/Blog';

export class BlogRouter extends PureComponent {
  static propTypes = {
    match: PropTypes.object.isRequired,
  }

  render() {
    const { match } = this.props;
    return (
      <React.Fragment>
        <Route
          exact
          path={match.path}
          component={Blog}
        />
        <Route
          path={`${match.path}/:id`}
          component={BlogPost}
        />
      </React.Fragment>
    );
  }
}

export default BlogRouter;
