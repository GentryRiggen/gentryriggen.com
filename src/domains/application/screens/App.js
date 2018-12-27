import React, { Component } from 'react'
import { BrowserRouter as Router, Route } from "react-router-dom";

import {
  View,
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
        <View
          display="flex"
          flexDirection="column"
          minHeight="100vh"
        >
          <View
            display="flex"
            flex="1 0 auto"
            width="100vw"
          >
            <Route path="/" exact component={AboutMe} />
            <Route path="/blog" component={BlogRouter} />
            <Route path="/login" component={Login} />
            <AdminRoute path="/admin" component={AdminRouter} />
          </View>
          <Footer />
        </View>
      </Router>
    );
  }
}

export default App;
