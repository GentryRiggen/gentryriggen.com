import { createStore, compose } from 'redux';
import rootReducer from 'lib/store/rootReducer';

const composeEnhancers = process.env.NODE_ENV === 'development'
  // eslint-disable-next-line
  ? window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose
  : compose;

const store = createStore(
  rootReducer,
  {},
  composeEnhancers(),
);

export default store;
