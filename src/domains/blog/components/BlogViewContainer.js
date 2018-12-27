import React, { PureComponent } from 'react';

import {
  Flex,
} from 'lib/components';

export class BlogViewContainer extends PureComponent {
  render() {
    return (
      <Flex
        flexDirection="column"
        p={['sm', 'lg', 'xl']}
        pt={['lg', 'xl', 'xl']}
      >
        {this.props.children}
      </Flex>
    );
  }
}

export default BlogViewContainer;
