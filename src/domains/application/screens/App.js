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
            <Route path="/admin" component={Login} />
          </View>
          <Footer />
        </View>
      </Router>
    );
  }
}

export default App;
