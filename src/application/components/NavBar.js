import React from 'react';
import theme from '../common/theme';
import H1 from './H1';

const styles = {
  navBar: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 16,
    height: theme.dimensions.navBarHeight,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.navBackgroundColor,
    zIndex: 3,
  },
  spacer: {
    display: 'flex',
    flexGrow: 1,
  },
  link: {
    paddingLeft: 12,
    color: theme.colors.textColor,
    textDecoration: 'none',
  },
  activeLink: {
    paddingLeft: 12,
    color: theme.colors.primaryColor,
    textDecoration: 'none',
  },
};

const NavBar = () => (
  <div style={styles.navBar}>
    <H1>Gentry Riggen</H1>
    <div style={styles.spacer} />
  </div>
);

export default NavBar;
