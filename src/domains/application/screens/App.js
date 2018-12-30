import React, { Component } from 'react'
import {
  BrowserRouter as Router,
  Redirect,
  Route,
  Switch,
} from "react-router-dom";
import {
  CSSTransition,
  TransitionGroup,
} from 'react-transition-group';

import {
  Flex,
} from 'lib/components';

import AboutMe from 'domains/about/screens/AboutMe';
import BlogRouter from 'domains/blog/navigation/BlogRouter';
import Footer from 'domains/application/components/Footer';
import Login from 'domains/admin/Screens/Login';
import initialize from 'domains/application/awaits/initialize';
import AdminRoute from 'domains/admin/components/AdminRoute';
import AdminRouter from 'domains/admin/navigation/AdminRouter';

class App extends Component {
  componentWillMount() {
    initialize();
  }

  render() {
    return (
      <Router>
        <Flex>
          <Route
            render={({ location }) => (
              <Flex
                flexDirection="column"
                alignItems="center"
                pt={['sm', 'lg', 'xl']}
                px="sm"
                data-test="screen-container"
              >
                <Route
                  exact
                  path="/"
                  render={() => <Redirect to="/about" />}
                />
                <TransitionGroup>
                  <CSSTransition
                    key={location.key}
                    timeout={350}
                    classNames="fade"
                  >
                    <Flex
                      flexDirection="column"
                      alignItems="center"
                      maxWidth="md"
                      minWidth={[0, 'sm', 'md', 'lg']}
                      data-test="screen-inner"
                    >
                      <Switch location={location}>
                        <Route path="/about" component={AboutMe} />
                        <Route path="/blog" component={BlogRouter} />
                        <Route path="/login" component={Login} />
                        <AdminRoute path="/admin" component={AdminRouter} />
                      </Switch>
                    </Flex>
                  </CSSTransition>
                </TransitionGroup>
              </Flex>
            )}
          />
          <Footer />
        </Flex>
      </Router>
    );
  }
}

export default App;
