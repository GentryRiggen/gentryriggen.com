import * as R from 'ramda';

import { getCollection } from 'lib/firebase';
import store from 'lib/store/index';

import { setFeatures } from 'domains/features/ducks/features';

export const getFeatures = async () => {
  const features = await getCollection('features');
  const enabledFeatures = R.map(
    f => ({ ...f, enabled: f.enabled === global.__ENVIRONMENT__ }),
    features,
  );
  store.dispatch(setFeatures(enabledFeatures));
};
