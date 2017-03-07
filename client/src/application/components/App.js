import React from 'react';
import { connect } from 'react-redux';
import { windowSizeChange } from '../ducks';
import theme from '../common/theme';
import NavBar from './NavBar';

const rand = 2;//Math.ceil(Math.random() * (2 - 1)) + 1;
const background = `images/background${rand}.png`;
const styles = {
  app: {
    fontFamily: theme.font.fontFamily,
    fontSize: theme.font.fontSize,
    backgroundColor: theme.colors.pageBackgroundColor,
    height: `calc(100vh - 48px)`,
    color: theme.colors.textColor,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 1,
    background: `url(${background}) 70% 50%`,
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
  },
  smallApp: {
    padding: 0,
    height: '100vh',
  },
  content: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    backgroundColor: theme.colors.navBackgroundColor,
    color: theme.colors.textColor,
    boxShadow: '0 7px 8px -4px rgba(0,0,0,.2), 0 12px 17px 2px rgba(0,0,0,.14), 0 5px 22px 4px rgba(0,0,0,.12)',
    padding: 16,
    height: '100%',
    maxHeight: 850,
    width: '100%',
    maxWidth: 1000,
    opacity: '0.92',
    zIndex: 2,
  },
  smallContent: {
    width: 'calc(100vw - 32px)',
  },
  innerContent: {
    paddingTop: theme.dimensions.navBarHeight,
    overflowY: 'scroll',
    '-webkit-overflow-scrolling': 'touch',
  },
};

class App extends React.Component {
  componentDidMount() {
    window.addEventListener('resize', this.handleResize());
    this.handleResize()();
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize());
  };

  handleResize() {
    return () => {
      this.props.dispatch(windowSizeChange(window.innerWidth));
    };
  }

  render() {
    const { children } = this.props;
    let smallApp = {};
    let smallContent = {};
    if (this.props.browser.isSmall) {
      smallApp = styles.smallApp;
      smallContent = styles.smallContent;
    }
    console.log({...styles.content, ...smallContent});
    return (
      <div
        style={{
          ...styles.app,
          ...smallApp,
        }}
      >
        <div
          style={{
            ...styles.content,
            ...smallContent,
          }}
        >
          <NavBar />
          <div style={styles.innerContent}>
            {children}
          </div>
        </div>
      </div>
    );
  }
}

App.propTypes = {
  browser: React.PropTypes.object.isRequired,
  children: React.PropTypes.any.isRequired,
  dispatch: React.PropTypes.func.isRequired,
};

export default connect(
  s => ({ browser: s.browser })
)(App);
