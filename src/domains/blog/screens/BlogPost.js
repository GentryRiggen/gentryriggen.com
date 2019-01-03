import React, { Component } from 'react';
import * as R from 'ramda';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import { createStructuredSelector } from 'reselect';
import Prism from 'prismjs';
import 'prismjs/components/prism-jsx';

import { mapNavigationParams } from 'lib/utils/navigation';
import {
  Button,
  Input,
  Text,
  View,
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

  componentDidUpdate() {
    this.onHighlightCode();
  }

  onHighlightCode = () => setTimeout(Prism.highlightAll, 500)

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
      <View
        flex={1}
        width={1}
      >
        <View
          flexStyle="horizontal"
          flex={1}
          maxHeight="160px"
        >
          <View
            flex={1}
            mr="md"
          >
            <Text>Title</Text>
            <Input
              type="text"
              value={post.title}
              onChange={this.onChangeTitle}
              width="85%"
            />
          </View>

          <View
            flex={1}
          >
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
          </View>
        </View>

        <View
          flex={1}
        >
          <Text>Body</Text>
          <textarea
            type="text"
            value={post.body}
            onChange={this.onChangeBody}
            rows="40"
          />
        </View>
      </View>
    );
  }

  renderPost() {
    const { post } = this.state;
    if (!post) {
      return null;
    }

    return (
      <React.Fragment>
        <Text textStyle="jumbo">{post.title}</Text>
        <Text textStyle="caption" pb="md">{formatDate(post.date)}</Text>

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
      <View flexStyle="vertical">
        {isLoggedIn && (
          <div>
            <Button onClick={this.toggleEditMode}>{editMode ? 'See Post' : 'Edit Post'}</Button>
          </div>
        )}
        {content}
      </View>
    )
  }
}

export default connect(mapState)(mapNavigationParams(BlogPost));
