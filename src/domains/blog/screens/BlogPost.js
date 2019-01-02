import React, { Component } from 'react';
import * as R from 'ramda';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import { createStructuredSelector } from 'reselect';
import Prism from 'prismjs';

import { mapNavigationParams } from 'lib/utils/navigation';
import {
  Button,
  Caption,
  Flex,
  Text,
  Jumbo,
} from 'lib/components';

import { ReBase } from 'lib/firebase';
import { formatDate } from 'lib/utils/date';

import { isLoggedInSelector } from 'domains/admin/selectors/admin';

const mapState = createStructuredSelector({
  isLoggedIn: isLoggedInSelector,
});

export class BlogPost extends Component {
  static propTypes = {
    isLoggedIn: PropTypes.bool.isRequired,
    id: PropTypes.string.isRequired,
  }

  state = {
    editMode: false,
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
    this.onHighlightCode();
  }

  onHighlightCode = () => setTimeout(Prism.highlightAll, 1000)

  onPost = post => this.setState({ post })

  onChangeTitle = ({ target: { value } }) =>
    this.setState(R.over(R.lensPath(['post', 'title']), () => value))

  onChangePublished = () =>
    this.setState(R.over(R.lensPath(['post', 'published']), R.not))

  onChangeDate = ({ target: { value } }) =>
    this.setState(R.over(R.lensPath(['post', 'date']), () => new Date(value)))

  onChangeBody = ({ target: { value } }) =>
    this.setState(R.over(R.lensPath(['post', 'body']), () => value), this.onHighlightCode)

  editMode = R.over(R.lens(R.prop('editMode'), R.assoc('editMode')), R.not)
  toggleEditMode = () => this.setState(s => this.editMode(s), this.onHighlightCode)

  renderEditor() {
    if (!this.props.isLoggedIn) {
      return null;
    }

    const { post } = this.state;
    if (!post) {
      return null;
    }

    return (
      <Flex>
        <Flex
          flexDirection="row"
          maxHeight="160px"
        >
          <Flex mr="md">
            <Text>Title</Text>
            <input
              type="text"
              value={post.title}
              onChange={this.onChangeTitle}
            />
          </Flex>

          <Flex>
            <Text>Published</Text>
            <input
              type="checkbox"
              value={post.published}
              checked={post.published}
              onChange={this.onChangePublished}
            />
            <div>
              <Text>{formatDate(post.date)}</Text>
              <input
                type="date"
                style={{ height: 32 }}
                onChange={this.onChangeDate}
              />
            </div>
          </Flex>
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

  renderPost() {
    const { post } = this.state;
    if (!post) {
      return null;
    }

    return (
      <React.Fragment>
        <Jumbo>{post.title}</Jumbo>
        <Caption pb="md">{formatDate(post.date)}</Caption>

        <ReactMarkdown
          className="blog-post"
          source={post.body}
        />
      </React.Fragment>
    );
  }

  render() {
    const { isLoggedIn } = this.props;
    const { editMode } = this.state;
    const content = editMode
      ? this.renderEditor()
      : this.renderPost();

    return (
      <Flex width={1} maxWidth="100%">
        {isLoggedIn && (
          <div>
            <Button onClick={this.toggleEditMode}>{editMode ? 'See Post' : 'Edit Post'}</Button>
          </div>
        )}
        {content}
      </Flex>
    )
  }
}

export default connect(mapState)(mapNavigationParams(BlogPost));
