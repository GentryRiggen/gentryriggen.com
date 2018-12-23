import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';

import { mapNavigationParams } from 'lib/utils/navigation';
import {
  Title,
  View,
} from 'lib/components';

export class BlogPost extends PureComponent {
  static propTypes = {
    id: PropTypes.string.isRequired,
  }

  render() {
    return (
      <View>
        <Title>Blog Post {this.props.id}</Title>
      </View>
    );
  }
}

export default mapNavigationParams(BlogPost);
