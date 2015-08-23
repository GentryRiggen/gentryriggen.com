(function () {
  'use strict';

  /* jshint -W117 */
  var bookModel = require('../models/book.model'),
    Q = require('q');

  function getSelectColumns(all) {
    var select = "id, author_id, book_series_id, title, artwork_url, publish_date, rating, fiction";
    if (all) {
      select += ', file_url';
    }
    return "*";
  }

  var repo = function (dbPool) {
    var bookRepo = {};
    var db = require('../services/db.service')(dbPool);

    bookRepo.getTotal = function () {
      var dfd = Q.defer();
      db.query('SELECT COUNT(id) as count FROM book').then(
        function (results) {
          if (results.length > 0) {
            dfd.resolve(results[0].count);
          } else {
            dfd.resolve(0);
          }
        }, function (err) {
          dfd.reject(err);
        });

      return dfd.promise;
    };

    bookRepo.getAll = function (skip, take, all) {
      var dfd = Q.defer(),
        select = getSelectColumns(all),
        query = 'SELECT ' + select + ' FROM book ORDER BY title, publish_date DESC LIMIT ' + skip + ', ' + take;

      db.query(query).then(
        function (books) {
          console.log('Found books', books);
          var response = [];
          for (var i = 0; i < books.length; i++) {
            response.push(bookModel.toJson(books[i]));
          }
          dfd.resolve(response);
        }, function (err) {
          dfd.reject(err);
        });

      return dfd.promise;
    };

    bookRepo.getById = function (id, all) {
      var dfd = Q.defer(),
        select = getSelectColumns(all);

      db.query('SELECT ' + select + ' FROM book WHERE id = ' + id).then(
        function (books) {
          if (books.length > 0) {
            var b = books[0];
            dfd.resolve(bookModel.toJson(b));
          } else {
            dfd.reject('Book not found');
          }
        }, function (err) {
          dfd.reject(err);
        });

      return dfd.promise;
    };

    bookRepo.save = function (id, book) {
      console.log('saving book: ', book);
      var dfd = Q.defer();
      var query = "UPDATE book SET " +
        "author_id = " + dbPool.escape(book.authorId) + "," +
        "book_series_id = " + dbPool.escape(book.bookSeriesId) + "," +
        "title = " + dbPool.escape(book.title) + "," +
        "publish_date = " + dbPool.escape(book.publishDate) + ", " +
        "rating = " + dbPool.escape(book.rating) + ", " +
        "fiction = " + dbPool.escape(book.fiction) + ", " +
        "review = " + dbPool.escape(book.review) + " " +
        "WHERE id = " + id;
      db.query(query).then(
        function () {
          dfd.resolve();
        }, function (err) {
          console.log(err);
          dfd.reject(err);
        });

      return dfd.promise;
    };

    bookRepo.saveArtwork = function(id, artworkUrl) {
      var dfd = Q.defer();
      var query = "UPDATE book SET " +
        "artwork_url = " + dbPool.escape(artworkUrl) + " " +
        "WHERE id = " + id;

      console.log('updating book artwork url', dbPool.escape(artworkUrl));
      db.query(query).then(
        function () {
          dfd.resolve();
        }, function (err) {
          console.log(err);
          dfd.reject(err);
        });

      return dfd.promise;
    };

    bookRepo.saveFile = function(id, fileName) {
      var dfd = Q.defer();
      var query = "UPDATE book SET " +
        "file_url = " + dbPool.escape(fileName) + " " +
        "WHERE id = " + id;
      db.query(query).then(
        function () {
          dfd.resolve();
        }, function (err) {
          console.log(err);
          dfd.reject(err);
        });

      return dfd.promise;
    };

    bookRepo.new = function () {
      var dfd = Q.defer(),
        date = new Date();
      date = date.toMysqlFormat();

      var query = "INSERT INTO book VALUES(" +
        "DEFAULT, 1, NULL, 'New Book', '', '', '" + date + "', 1, 0);";
      db.query(query).then(
        function (result) {
          dfd.resolve(result.insertId);
        }, function (err) {
          console.log(err);
          dfd.reject(err);
        });

      return dfd.promise;
    };

    bookRepo.deleteById = function (id) {
      var dfd = Q.defer(),
        query = "DELETE FROM book WHERE id = " + id;
      db.query(query).then(
        function (result) {
          dfd.resolve(result);
        }, function (err) {
          dfd.reject(err);
        });

      return dfd.promise;
    };

    return bookRepo;
  };

  module.exports = repo;
})();
