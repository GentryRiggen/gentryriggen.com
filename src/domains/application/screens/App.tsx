import * as React from 'react'
import { ThemeProvider } from 'styled-components'
import {
  Redirect,
  BrowserRouter,
  Route,
  RouteComponentProps,
  Switch,
} from 'react-router-dom'

import 'lib/styles/css/index.css'
import theme from 'lib/styles/theme'
import SplashScreen from 'domains/splash/screens/SplashScreen'
import View from 'lib/components/View'

const renderRoute = (props: RouteComponentProps) => {
  return (
    <Switch location={props.location}>
      <Route exact={true} path="/" component={SplashScreen} />
      <Redirect to="/" />
    </Switch>
  )
}

export const App = () => {
  return (
    <ThemeProvider theme={theme}>
      <View
        id="page=container"
        position="relative"
        minHeight="100vh"
        minWidth="100vw"
      >
        <BrowserRouter>
          <Route render={renderRoute} />
        </BrowserRouter>
      </View>
    </ThemeProvider>
  )
}

export default App
