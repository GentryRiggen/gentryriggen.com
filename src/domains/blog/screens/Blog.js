import React, { PureComponent } from 'react';

import { ReBase } from 'lib/firebase';
import {
  View,
  Title,
} from 'lib/components';
import BlogPostRow from 'domains/blog/components/BlogPostRow';

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
      <View>
      <View
        display="flex"
        flexDirection="column"
        p={['sm', 'lg', 'xl']}
        pt={['lg', 'xl', 'xl']}
      >
        <Title>Blog</Title>
        {this.state.posts.map(this.renderPost)}
      </View>
      </View>
    );
  }
}

export default Blog;
