import React from 'react'
import ReactDOM from 'react-dom'
import { ThemeProvider } from 'styled-components';

import './index.css'

import { theme } from 'lib/styles/theme';

import App from 'domains/application/screens/App'

ReactDOM.render(
  (
    <ThemeProvider theme={theme}>
      <App />
    </ThemeProvider>
  ),
  document.getElementById('root'),
);
