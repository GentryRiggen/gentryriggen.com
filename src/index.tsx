import * as React from 'react'
import * as ReactDOM from 'react-dom'
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

const renderRoute = (props: RouteComponentProps) => {
  return (
    <Switch location={props.location}>
      <Route exact={true} path="/" component={SplashScreen} />
      <Redirect to="/" />
    </Switch>
  )
}
ReactDOM.render(
  <ThemeProvider theme={theme}>
    <BrowserRouter>
      <Route render={renderRoute} />
    </BrowserRouter>
  </ThemeProvider>,
  document.getElementById('root'),
)
