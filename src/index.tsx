import React from 'react'
import ReactDOM from 'react-dom'
import {
  ThemeProvider,
  CSSReset,
  ColorModeProvider,
  Box,
  Flex,
} from '@chakra-ui/core'
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom'
import 'lib/styles/index.css'

import customTheme from 'lib/styles/theme'
import Header from 'domains/application/components/Header'
import About from 'domains/about/screens/About'

ReactDOM.render(
  <ThemeProvider theme={customTheme}>
    <ColorModeProvider>
      <CSSReset />
      <Flex direction="column" justify="flex-start" align="center" flex={1}>
        <Box px={[3, 4]} width={['100%', '80%', '48em', '62em']}>
          <Header />
          <Router>
            <Switch>
              <Route path="/">
                <About />
              </Route>
            </Switch>
          </Router>
        </Box>
      </Flex>
    </ColorModeProvider>
  </ThemeProvider>,
  document.getElementById('root'),
)
