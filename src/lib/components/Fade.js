import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Transition } from 'react-transition-group';

const duration = 300;

const defaultStyle = {
  transition: `opacity ${duration}ms ease-in-out`,
  opacity: 0,
}

const transitionStyles = {
  entering: { opacity: 0 },
  entered: { opacity: 1 },
};

export class Fade extends PureComponent {
  static propTypes = {
    in: PropTypes.bool,
  }

  static defaultProps = {
    in: true,
  }

  render() {
    return (
      <Transition
        in={this.props.in}
        timeout={duration}
        appear
      >
        {(state) => (
          <div style={{
            ...defaultStyle,
            ...transitionStyles[state]
          }}>
            {this.props.children}
          </div>
        )}
      </Transition>
    );
  }
}

export default Fade;
