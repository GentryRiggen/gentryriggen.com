(function () {
  'use strict';

  /* jshint -W117 */
  var bookModel = require('../models/book.model'),
    Q = require('q');

  function getSelectColumns(all) {
    var select = "b.id, b.author_id, b.book_series_id, b.title, b.artwork_url, b.publish_date, b.rating, b.fiction, " +
      "b.review, b.have_read, b.date_read";
    if (all) {
      select += ', b.file_url';
    }

    return select;
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

    bookRepo.getAll = function (skip, take, q, all) {
      var dfd = Q.defer(),
        select = getSelectColumns(all),
        getAllWhere = all ? '' : 'AND b.have_read = 1',
        searchQuery = '"%' + q + '%"',
        query = 'SELECT ' + select + ', a.first_name as author_first_name, a.last_name as author_last_name ' +
          'FROM book b ' +
          'LEFT JOIN author a ON (a.id = b.author_id) ' +
          'LEFT JOIN book_series bs ON (bs.id = b.book_series_id) ' +
          'WHERE (b.title LIKE ' + searchQuery +
          ' OR a.first_name LIKE ' + searchQuery + ' OR a.last_name LIKE ' + searchQuery +
          ' OR b.title LIKE ' + searchQuery + ') ' + getAllWhere +
          ' ORDER BY b.date_read DESC, b.title, b.publish_date DESC' +
          ' LIMIT ' + skip + ', ' + take;

      db.query(query).then(
        function (books) {
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
        select = getSelectColumns(all),
        query = 'SELECT ' + select + ', a.first_name as author_first_name, a.last_name as author_last_name ' +
          'FROM book b ' +
          'LEFT JOIN author a ON (a.id = b.author_id) ' +
          'WHERE b.id = ' + id;

      console.log(query);
      db.query(query).then(
        function (books) {
          if (books.length > 0) {
            console.log('Date Read: ', books[0].date_read);
            dfd.resolve(bookModel.toJson(books[0]));
          } else {
            dfd.reject('Book not found');
          }
        }, function (err) {
          dfd.reject(err);
        });

      return dfd.promise;
    };

    bookRepo.save = function (id, book) {
      var dfd = Q.defer();
      var query = "UPDATE book SET " +
        "author_id = " + dbPool.escape(book.authorId) + "," +
        "book_series_id = " + dbPool.escape(book.bookSeriesId) + "," +
        "title = " + dbPool.escape(book.title) + "," +
        "publish_date = " + dbPool.escape(book.publishDate) + ", " +
        "rating = " + dbPool.escape(book.rating) + ", " +
        "fiction = " + dbPool.escape(book.fiction) + ", " +
        "review = " + dbPool.escape(book.review) + ", " +
        "have_read = " + dbPool.escape(book.haveRead) + ", " +
        "date_read = " + dbPool.escape(book.dateRead) + " " +
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

    bookRepo.saveArtwork = function (id, artworkUrl) {
      var dfd = Q.defer();
      var query = "UPDATE book SET " +
        "artwork_url = " + dbPool.escape(artworkUrl) + " " +
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

    bookRepo.saveFile = function (id, fileName) {
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

      var query = "INSERT INTO book " +
        "(author_id, book_series_id, title, artwork_url, file_url, publish_date, date_read) " +
        "VALUES(1, NULL, 'New Book', '', '', '" + date + "', '" + date + "');";

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
