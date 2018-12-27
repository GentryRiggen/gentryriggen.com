import React, { Component } from 'react'
import { BrowserRouter as Router, Route } from "react-router-dom";

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
        <Flex
          flexDirection="column"
          alignItems="center"
          pt={['sm', 'lg', 'xl']}
          px="sm"
          data-test="screen-container"
        >
          <Flex
            flexDirection="column"
            alignItems="center"
            maxWidth="md"
            minWidth={[0, 'sm', 'md', 'lg']}
            data-test="screen-inner"
          >
            <Route path="/" exact component={AboutMe} />
            <Route path="/blog" component={BlogRouter} />
            <Route path="/login" component={Login} />
            <AdminRoute path="/admin" component={AdminRouter} />
          </Flex>
          <Footer />
        </Flex>
      </Router>
    );
  }
}

export default App;
