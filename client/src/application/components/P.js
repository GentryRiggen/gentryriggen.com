import React from 'react';
import { connect } from 'react-redux';
import theme from '../common/theme';

const styles = {
  p: {
    fontSize: theme.font.fontSize,
    paddingTop: 4,
    paddingBottom: 4,
  },
  pSmall: {
    fontSize: theme.font.fontSizeSmall,
    paddingTop: 4,
    paddingBottom: 4,
  },
  h1: {
    fontSize: theme.font.fontSizeH1,
  },
};

class P extends React.Component {
  render() {
    const {
      browser,
      children,
    } = this.props;
    return (
      <div style={browser.isSmall ? styles.pSmall : styles.p}>
        {children}
      </div>
    );
  }
}

export default connect(s => ({ browser: s.browser }))(P);
