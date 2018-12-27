import { combineReducers } from 'redux';

import { reducers as application } from 'domains/application/ducks/application';
import features from 'domains/features/ducks/features';

export default combineReducers({
  ...application,
  features,
});
