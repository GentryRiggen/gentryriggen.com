import { combineReducers } from 'redux';
import books from '../../books/ducks';
import browser from '../../application/ducks';

export const reducers = {
  books,
  browser,
};

const rootReducer = combineReducers({
  ...reducers,
});

export default rootReducer;
