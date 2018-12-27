import React, { PureComponent } from 'react';
import * as R from 'ramda';

const getDisplayName = WrappedComponent => WrappedComponent.displayName
  || WrappedComponent.name
  || 'Component';

export const mapNavigationParams = (WrappedComponent) => {
  class MapNavigationParams extends PureComponent {
    render() {
      return (
        <WrappedComponent
          {...this.props}
          {...(R.pathOr({}, ['match', 'params'], this.props))}
        />
      );
    }
  }
  MapNavigationParams.displayName = `MapNavigationParams(${getDisplayName(WrappedComponent)})`;
  return MapNavigationParams;
};
