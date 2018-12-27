import React, { PureComponent } from 'react';

import { ReBase } from 'lib/firebase';
import {
  Title,
} from 'lib/components';

import BlogPostRow from 'domains/blog/components/BlogPostRow';
import BlogViewContainer from 'domains/blog/components/BlogViewContainer';

export class Blog extends PureComponent {
  state = {
    posts: [],
  }

  componentWillMount() {
    ReBase.listenToCollection(
      'posts',
      {
        context: this,
        withIds: true,
        then: this.onPosts,
      },
    );
  }

  onPosts = posts => this.setState({ posts })

  renderPost = (post, index) => <BlogPostRow post={post} key={index} />

  render() {
    return (
      <BlogViewContainer>
        <Title>Blog</Title>
        {this.state.posts.map(this.renderPost)}
      </BlogViewContainer>
    );
  }
}

export default Blog;
