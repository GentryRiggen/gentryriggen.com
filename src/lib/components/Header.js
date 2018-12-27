import React, { PureComponent } from 'react';

import View from './View';

const HEIGHT = 64;

export class Header extends PureComponent {
  static HEIGHT = HEIGHT

  render() {
    return (
      <View
        position="fixed"
        height={Header.HEIGHT}
        bg="blue"
        top={0}
        right={0}
        bottom={0}
        left={0}
      >

      </View>
    );
  }
}

export default Header;
