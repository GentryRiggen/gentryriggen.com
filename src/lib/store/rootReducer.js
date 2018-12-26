import { combineReducers } from 'redux';

import { reducers as application } from 'domains/application/ducks/application';

export default combineReducers({
  ...application,
});
