import React, { Component } from 'react';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';

import { mapNavigationParams } from 'lib/utils/navigation';
import {
  Caption,
  Flex,
  Title,
} from 'lib/components';

import { ReBase } from 'lib/firebase';
import { formatDate } from 'lib/utils/date';

export class BlogPost extends Component {
  static propTypes = {
    id: PropTypes.string.isRequired,
  }

  state = {
    post: null
  }

  componentWillMount() {
    ReBase.syncDoc(
      `posts/${this.props.id}`,
      {
        context: this,
        state: 'post',
        // then: this.onPost,
      },
    );
  }

  onPost = post => this.setState({ post })

  onChangeBody = ({ target: { value }}) =>
    this.setState(s => ({ post: { ...s.post, body: value } }))

  render() {
    const { post } = this.state;
    if (!post) {
      return null;
    }

    return (
      <Flex>
        <Title>{post.title}</Title>
        <Caption>{formatDate(post.date)}</Caption>
        <textarea
          type="text"
          value={post.body}
          onChange={this.onChangeBody}
          rows="12"
          cols="40"
          style={{ maxWidth: '500px' }}
        />
        <ReactMarkdown source={post.body} />
      </Flex>
    );
  }
}

export default mapNavigationParams(BlogPost);
