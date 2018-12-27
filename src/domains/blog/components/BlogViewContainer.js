import React, { PureComponent } from 'react';

import { View } from 'lib/components';

export class BlogViewContainer extends PureComponent {
  render() {
    return (
      <View
        display="flex"
        flexDirection="column"
        p={['sm', 'lg', 'xl']}
        pt={['lg', 'xl', 'xl']}
      >
        {this.props.children}
      </View>
    );
  }
}

export default BlogViewContainer;
