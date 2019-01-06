import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { createStructuredSelector } from 'reselect';

import { ReBase, firestore } from 'lib/firebase';
import {
  Button,
  View,
  Text,
} from 'lib/components';

import BlogPostRow from 'domains/blog/components/BlogPostRow';
import { isLoggedInSelector } from 'domains/admin/selectors/admin';
import trackBlogAnalytics from 'domains/blog/trackBlogAnalytics';

const mapState = createStructuredSelector({
  isLoggedIn: isLoggedInSelector,
});

export class Blog extends PureComponent {
  static propTypes = {
    isLoggedIn: PropTypes.bool.isRequired,
  }

  state = {
    posts: [],
  }

  componentWillMount() {
    trackBlogAnalytics('Viewed Blog');
    ReBase.listenToCollection(
      'posts',
      {
        context: this,
        withIds: true,
        query: this.getQuery,
        then: this.onPosts,
      },
    );
  }

  onPosts = posts => this.setState({ posts })

  onCreatePost = () => firestore.collection('posts').add({
    title: 'New Post',
    body: '',
    published: false,
    date: new Date(),
  });

  getQuery = (ref) => {
    if (this.props.isLoggedIn) {
      return ref.orderBy('date', 'desc');
    }

    return ref
      .where('published', '==', true)
      .orderBy('date', 'desc');
  }

  renderCreatePost() {
    if (!this.props.isLoggedIn) {
      return null;
    }

    return (
      <Button onClick={this.onCreatePost}>Create Post</Button>
    );
  }

  renderPost = (post, index) => <BlogPostRow post={post} key={index} />

  render() {
    return (
      <View>
        <Text textStyle="title">Blog</Text>
        {this.renderCreatePost()}
        {this.state.posts.map(this.renderPost)}
      </View>
    );
  }
}

export default connect(mapState)(Blog);
