import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { CSSTransition } from 'react-transition-group';

import './FlyIn.css';

const FLY_IN_TOP = 'fly-in-top';
const FLY_IN_BOTTOM = 'fly-in-bottom';
const FLY_IN_BOTTOM_LEFT = 'fly-in-bottom-left';
const FLY_IN_BOTTOM_RIGHT = 'fly-in-bottom-right';
const FLY_IN_RIGHT = 'fly-in-right';
const FLY_IN_LEFT = 'fly-in-left';

export class FlyIn extends PureComponent {
  static FLY_IN_TOP = FLY_IN_TOP
  static FLY_IN_BOTTOM = FLY_IN_BOTTOM
  static FLY_IN_BOTTOM_LEFT = FLY_IN_BOTTOM_LEFT
  static FLY_IN_BOTTOM_RIGHT = FLY_IN_BOTTOM_RIGHT
  static FLY_IN_RIGHT = FLY_IN_RIGHT
  static FLY_IN_LEFT = FLY_IN_LEFT

  static propTypes = {
    type: PropTypes.oneOf([
      FLY_IN_TOP,
      FLY_IN_BOTTOM,
      FLY_IN_BOTTOM_LEFT,
      FLY_IN_BOTTOM_RIGHT,
      FLY_IN_RIGHT,
      FLY_IN_LEFT,
    ]),
    children: PropTypes.any.isRequired,
  }

  static defaultProps = {
    type: FLY_IN_TOP
  }

  render() {
    return (
      <CSSTransition
        timeout={1500}
        classNames={this.props.type}
        appear
        in
      >
        {this.props.children}
      </CSSTransition>
    );
  }
}

export default FlyIn;
