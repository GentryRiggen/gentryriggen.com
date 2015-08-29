(function () {
  'use strict';

  /* jshint -W117 */
  var conf = require('../config/conf');

  /* jshint -W117 */
  exports.toJson = function (book) {
    var bookModel = {
      id: book.id,
      authorId: book.author_id,
      authorFirstName: '',
      authorLastName: '',
      bookSeriesId: book.book_series_id,
      title: book.title,
      artworkUrl: conf.blobStorage.url + '/' + book.artwork_url,
      fileUrl: conf.blobStorage.url + '/' + book.file_url,
      publishDate: book.publish_date,
      haveRead: book.have_read,
      dateRead: book.date_read,
      rating: book.rating,
      fiction: book.fiction,
      review: book.review
    };

    if ('author_first_name' in book) {
      bookModel.authorFirstName = book.author_first_name;
    }

    if ('author_last_name' in book) {
      bookModel.authorLastName = book.author_last_name;
    }

    return bookModel;
  };
})();
