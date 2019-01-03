import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import {
  View,
  Text,
} from 'lib/components';

export class BlogPostRow extends PureComponent {
  static propTypes = {
    post: PropTypes.shape({
      id: PropTypes.string,
      title: PropTypes.string,
    }).isRequired,
  }

  render() {
    const {
      id,
      title,
    } = this.props.post;

    return (
      <Link to={`/blog/${id}`}>
        <View
          pt="md"
          pb="md"
        >
          <Text textStyle="subtitle">{title}</Text>
          <Text textStyle="caption">December 24th, 2018</Text>
        </View>
      </Link>
    );
  }
}

export default BlogPostRow;
