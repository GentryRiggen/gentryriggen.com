var conf = require('../config/conf');

exports.toJson = function (book) {
  if (book.content) {
    book.review = book.content;
  }

  var sampleReview = book.review;
  if (sampleReview && sampleReview.length > 300) {
    sampleReview = sampleReview.substring(0, 300);
  }

  var bookModel = {
    id: book.id,
    authorId: book.author_id,
    authorFirstName: book.first_name ? book.first_name : '',
    authorLastName: book.last_name ? book.last_name : '',
    bookSeriesId: book.book_series_id,
    title: book.title,
    artworkUrl: conf.blobStorage.url + '/' + book.artwork_url,
    fileUrl: conf.blobStorage.url + '/' + book.file_url,
    publishDate: book.publish_date,
    haveRead: book.have_read,
    mainPage: book.main_page,
    dateRead: book.date_read,
    rating: book.rating,
    fiction: book.fiction,
    review: book.review,
    sampleReview: sampleReview,
    url: conf.appUrl + '/#!/books/' + book.id
  };



  return bookModel;
};

exports.fromJson = function (book) {
  var dateNow = (new Date()).toMysqlFormat();
  var dbReadyBook = {
    id: ('id' in book) ? book.id : 0,
    title: ('title' in book) ? book.title : "",
    artwork_url: ('artworkUrl' in book) ? book.artworkUrl.substr(book.artworkUrl.lastIndexOf('/') + 1): "",
    file_url: ('fileUrl' in book) ? book.fileUrl.substr(book.fileUrl.lastIndexOf('/') + 1): "",
    publish_date: ('publishDate' in book) ? book.publishDate : dateNow,
    rating: ('rating' in book) ? book.rating : 0,
    fiction: ('fiction' in book) ? book.fiction : 0,
    review: ('review' in book) ? book.review : '',
    have_read: ('haveRead' in book) ? book.haveRead : 0,
    date_read: ('dateRead' in book) ? book.dateRead : dateNow,
    main_page: ('mainPage' in book) ? book.mainPage : 0
  };

  if ('authorId' in book) {
    dbReadyBook.author_id = book.authorId;
  } else {
    // DEFAULT AUTHOR
    dbReadyBook.author_id = 1;
  }

  if ('bookSeriesId' in book) {
    dbReadyBook.book_series_id = book.bookSeriesId;
  }

  return dbReadyBook;
};
