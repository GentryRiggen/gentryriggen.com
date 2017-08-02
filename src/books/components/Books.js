import React from 'react';
import { connect } from 'react-redux';
import moment from 'moment';
import { getBooks } from '../ducks';
import P from '../../application/components/P';
import Spinner from '../../application/components/Spinner';

const styles = {
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  books: {
    display: 'flex',
    flexFlow: 'wrap row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  book: {
    position: 'relative',
    width: 160,
    height: 220,
    backgroundColor: '#fff',
    margin: 4,
  },
  smallBook: {
    width: 130,
    height: 200,
  },
  bookDetails: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    backgroundColor: '#000',
    opacity: '0.9',
    padding: 8,
  },
  bookTitle: {
    margin: 0,
    padding: 0,
    fontSize: 14,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  },
  bookAuthor: {
    margin: 0,
    padding: 0,
    fontSize: 12,
  },
};

class Books extends React.Component {
  componentWillMount() {
    this.props.dispatch(getBooks());
  }

  renderBook(book) {
    const smallBook = this.props.browser.isSmall ? styles.smallBook : {};
    return  (
      <div
        key={book.id}
        style={{
          ...styles.book,
          ...smallBook,
          background: `url(${book.artworkUrl})`,
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div style={styles.bookDetails}>
          <p style={styles.bookTitle}>{book.title}</p>
          <p style={styles.bookAuthor}>{book.authorLastName}, {book.authorFirstName}</p>
          <p style={styles.bookAuthor}>Read: {(moment(book.dateRead)).format('YYYY-MM-DD')}</p>
        </div>
      </div>
    );
  }

  renderBooks() {
    return this.props.books.all.map(b => this.renderBook(b));
  }

  render() {
    return (
      <div style={styles.content}>
        <P>
          I love to read and I love to see what others enjoy and recommend.
          It's like going into someones house and seeing their library.
          It can tell you a lot about a person.
          What they're interested in and what they dream about.
          It's similar to seeing what music someone has on their iPod.
          It helps when getting to know them.
        </P>
        <P>
          I am a very recent sci fi fanatic but I have always really enjoyed a good biography and non-fiction book.
          Here is my library so that you can get to know me better and see what I enjoy.
        </P>

        <div style={styles.books}>
          {this.props.books.all.length < 1 ? <Spinner /> : this.renderBooks()}
        </div>
      </div>
    );
  }
}

Books.propTypes = {
  books: React.PropTypes.object.isRequired,
  browser: React.PropTypes.object.isRequired,
  dispatch: React.PropTypes.func.isRequired,
};

export default connect(
  s => ({
    books: s.books,
    browser: s.browser,
  })
)(Books);
