import React, { Component } from 'react'
import { BrowserRouter as Router, Route, Link } from "react-router-dom";

import BlogRouter from 'domains/blog/navigation/BlogRouter';

import {
  View,
} from 'lib/components';


const Index = () => <h2>Home</h2>;

class App extends Component {
  render() {
    return (
      <Router>
        <View>
          <Link to="/">Home</Link>
          <Link to="/blog/">Blog</Link>
          <Route path="/" exact component={Index} />
          <Route path="/blog" component={BlogRouter} />
        </View>
      </Router>
    );
  }
}

export default App;
