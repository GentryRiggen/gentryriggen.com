import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';

import {
  Flex,
} from 'lib/components/View';

export class Screen extends PureComponent {
  static propTypes = {
    children: PropTypes.any.isRequired,
  }

  render() {
    return (
      <Flex
        flexDirection="column"
        alignItems="center"
        pt={['sm', 'lg', 'xl']}
        px={['sm', 'lg', 'xl']}
        data-test="screen-container"
      >
        <Flex
          flexDirection="column"
          maxWidth="md"
          data-test="screen-inner"
        >
          {this.props.children}
        </Flex>
      </Flex>
    );
  }
}

export default Screen;
