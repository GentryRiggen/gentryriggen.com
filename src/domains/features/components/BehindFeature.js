import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { createStructuredSelector } from 'reselect';

import { isFeatureEnabledSelector } from 'domains/features/selectors/features';

const stateMap = createStructuredSelector({
  featureEnabled: isFeatureEnabledSelector,
});

export class BehindFeature extends PureComponent {
  static propTypes = {
    feature: PropTypes.string.isRequired,
    featureEnabled: PropTypes.bool.isRequired,
    on: PropTypes.any,
    off: PropTypes.any,
  }

  static defaultProps = {
    on: () => null,
    off: () => null,
  }

  getComponent() {
    if (this.props.featureEnabled) {
      return this.props.on;
    }

    return this.props.off;
  }

  render() {
    const Component = this.getComponent();

    if (React.isValidElement(Component)) {
      return Component;
    }

    return <Component {...this.props} />;
  }
}

export default connect(stateMap)(BehindFeature);
