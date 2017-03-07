import React from 'react';
import { render } from 'react-dom';
import { Provider } from 'react-redux';
import {
  Router,
  Route,
  IndexRoute,
  browserHistory,
} from 'react-router';
import './index.css';
import configureStore from './application/store';
import App from './application/components/App';
import Home from './home/components/Home';
import Books from './books/components/Books';

const store = configureStore();

render(
  <Provider store={store}>
    <Router history={browserHistory}>
      <Route path="/" component={App}>
        <IndexRoute component={Home}/>
        <Route path="/" component={Home}/>
        <Route path="/apps" component={Books}/>
        <Route path="/books" component={Books}/>
      </Route>
      <Route path="/admin" component={App}>
        <IndexRoute component={Home}/>
        <Route path="/" component={Home}/>
        <Route path="/books" component={Books}/>
      </Route>
    </Router>
  </Provider>,
  document.getElementById('root')
);
