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

const TransitionGroupWrapper = props => (
  <Flex
    {...props}
    width="100%"
    maxWidth="md"
  />
);

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
                alignItems="center"
                pt={['lg', 'lg', 'xl']}
                px="md"
                data-test="screen-container"
              >
                <Route
                  exact
                  path="/"
                  render={() => <Redirect to="/about" />}
                />
                <TransitionGroup
                  data-test="transitionGroup"
                  component={TransitionGroupWrapper}
                >
                  <CSSTransition
                    key={location.key}
                    timeout={350}
                    classNames="fade"
                    data-test="cssTransition"
                  >
                    <Switch location={location}>
                      <Route path="/about" component={AboutMe} />
                      <Route path="/blog" component={BlogRouter} />
                      <Route path="/login" component={Login} />
                      <AdminRoute path="/admin" component={AdminRouter} />
                    </Switch>
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
