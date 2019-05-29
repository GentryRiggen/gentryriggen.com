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
import Footer from 'domains/splash/components/Footer'
import View from 'lib/components/View'

const renderRoute = (props: RouteComponentProps) => {
  return (
    <Switch location={props.location}>
      <Route exact={true} path="/" component={SplashScreen} />
      <Redirect to="/" />
    </Switch>
  )
}

const FOOTER_SMALL_HEIGHT = 80
const FOOTER_REGULAR_HEIGHT = 116
ReactDOM.render(
  <ThemeProvider theme={theme}>
    <View
      id="page=container"
      position="relative"
      minHeight="100vh"
      minWidth="100vw"
    >
      <View
        id="content-wrap"
        px={[3, 3, 0]}
        pb={[FOOTER_SMALL_HEIGHT + 64, FOOTER_REGULAR_HEIGHT + 64]}
        maxWidth={1440}
        m="0 auto"
      >
        <BrowserRouter>
          <Route render={renderRoute} />
        </BrowserRouter>
      </View>

      <View
        id="footer"
        height={[FOOTER_SMALL_HEIGHT, FOOTER_REGULAR_HEIGHT]}
        position="absolute"
        bottom="0"
        width="100%"
        boxSizing="border-box"
      >
        <Footer />
      </View>
    </View>
  </ThemeProvider>,
  document.getElementById('root'),
)
