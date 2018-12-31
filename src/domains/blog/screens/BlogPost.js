import React, { Component } from 'react';
import * as R from 'ramda';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import { createStructuredSelector } from 'reselect';
import Prism from 'prismjs';

import { mapNavigationParams } from 'lib/utils/navigation';
import {
  Caption,
  Flex,
  Text,
  Jumbo,
} from 'lib/components';

import { ReBase } from 'lib/firebase';
import { formatDate } from 'lib/utils/date';

import { selectors } from 'domains/application/ducks/application';
import View from 'lib/components/View';

const mapState = createStructuredSelector({
  loggedInUser: selectors.loggedInUser.get,
});

export class BlogPost extends Component {
  static propTypes = {
    loggedInUser: PropTypes.any,
    id: PropTypes.string.isRequired,
  }

  static defaultProps = {
    loggedInUser: null,
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
      },
    );
  }

  componentDidMount() {
    this.highlightCode();
  }

  highlightCode = () => setTimeout(Prism.highlightAll, 1000)

  onPost = post => this.setState({ post })

  onChangeTitle = ({ target: { value } }) =>
    this.setState(R.over(R.lensPath(['post', 'title']), () => value))

  onChangePublished = () =>
    this.setState(R.over(R.lensPath(['post', 'published']), R.not))

  onChangeDate = ({ target: { value } }) =>
    this.setState(R.over(R.lensPath(['post', 'date']), () => new Date(value)))

  onChangeBody = ({ target: { value } }) =>
    this.setState(R.over(R.lensPath(['post', 'body']), () => value), this.highlightCode)

  renderEditor() {
    if (!this.props.loggedInUser) {
      return null;
    }

    const { post } = this.state;

    return (
      <Flex p="md">
        <Text>Title</Text>
        <input
          type="text"
          value={post.title}
          onChange={this.onChangeTitle}
        />

        <Flex flexDirection="row" my="lg" flex={0}>
          <Text>Published</Text>
          <input
            type="checkbox"
            value={post.published}
            checked={post.published}
            onChange={this.onChangePublished}
          />
          <Text>Date</Text>
          <div>
            <Text>{formatDate(post.date)}</Text>
          <input
            type="date"
            style={{ height: 32 }}
            onChange={this.onChangeDate}
          />
          </div>
        </Flex>
        <Text>Body</Text>
        <textarea
          type="text"
          value={post.body}
          onChange={this.onChangeBody}
          rows="12"
          cols="40"
        />
      </Flex>
    );
  }

  render() {
    const { post } = this.state;
    const { loggedInUser } = this.props;
    if (!post) {
      return null;
    }

    return (

      <Flex
        flexDirection={[
          'column',
          'column',
          !!loggedInUser ? 'row' : 'column',
        ]}
      >
        {this.renderEditor()}
        <Flex>
          <Jumbo>{post.title}</Jumbo>
          <Caption pb="md">{formatDate(post.date)}</Caption>
          <ReactMarkdown
            className="blog-post"
            source={post.body}
          />
        </Flex>
      </Flex>
    );
  }
}

export default connect(mapState)(mapNavigationParams(BlogPost));
