import React, { Component } from 'react'
import { BrowserRouter as Router, Route } from "react-router-dom";

import 'lib/firebase';
import AboutMe from 'domains/about/screens/AboutMe';
import BlogRouter from 'domains/blog/navigation/BlogRouter';

import {
  View,
} from 'lib/components';

class App extends Component {
  render() {
    return (
      <Router>
        <View>
          <Route path="/" exact component={AboutMe} />
          <Route path="/blog" component={BlogRouter} />
        </View>
      </Router>
    );
  }
}

export default App;
