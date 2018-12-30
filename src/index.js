import React from 'react'
import ReactDOM from 'react-dom'
import { ThemeProvider } from 'styled-components';
import { Provider } from 'react-redux';

import './global';
import './index.css'
import './fade.css'

import { theme } from 'lib/styles/theme';
import store from 'lib/store/index';

import App from 'domains/application/screens/App'

ReactDOM.render(
  (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <App />
      </ThemeProvider>
    </Provider>
  ),
  document.getElementById('root'),
);
