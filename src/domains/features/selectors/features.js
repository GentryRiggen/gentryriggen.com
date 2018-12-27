import * as R from 'ramda';
import { createSelector } from 'reselect';

export const featuresSelector = R.propOr({}, 'features');
export const featurePropSelector = (_, props) => R.propOr('', 'feature', props);

export const featureSelector = createSelector(
  featuresSelector,
  featurePropSelector,
  (features, featureName) => R.find(R.propEq('name', featureName), features),
);

export const isFeatureEnabledSelector = createSelector(
  featureSelector,
  R.propOr(false, 'enabled'),
);
