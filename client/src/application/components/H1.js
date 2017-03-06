import React from 'react';
import { connect } from 'react-redux';
import theme from '../common/theme';

const styles = {
  h1: {
    fontSize: theme.font.fontSizeH1,
  },
  h1Small: {
    fontSize: theme.font.fontSizeH1Small,
  },
};

class H1 extends React.Component {
  render() {
    const {
      browser,
      children,
    } = this.props;
    return (
      <div style={browser.isSmall ? styles.h1Small : styles.h1}>
        {children}
      </div>
    );
  }
}

export default connect(
  s => ({
    browser: s.browser,
  })
)(H1);
