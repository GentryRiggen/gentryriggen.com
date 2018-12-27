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
          minHeight="100vh"
        >
          <Flex
            flex="1 0 auto"
            flexDirection="column"
            width="100vw"
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
