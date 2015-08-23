(function () {
  'use strict';

  /* jshint -W117 */
  var conf = require('../config/conf');

  /* jshint -W117 */
  exports.toJson = function (book) {
    return {
      id: book.id,
      authorId: book.author_id,
      bookSeriesId: book.book_series_id,
      title: book.title,
      artworkUrl: conf.blobStorage.url + '/' + book.artwork_url,
      fileUrl: conf.blobStorage.url + '/' + book.file_url,
      publishDate: book.publish_date,
      rating: book.rating,
      fiction: book.fiction,
      review: book.review
    };
  };
})();
