/* jshint -W117 */
var authorModel = require('../models/author.model'),
  Q = require('q');

var repo = function (dbPool) {
  var authorRepo = {};
  var db = require('../services/db.service')(dbPool);

  authorRepo.getAll = function () {
    var dfd = Q.defer(),
      query = 'SELECT * FROM author ORDER BY last_name, first_name;';

    db.query(query).then(
      function (authors) {
        var response = [];
        for (var i = 0; i < authors.length; i++) {
          response.push(authorModel.toJson(authors[i]));
        }
        dfd.resolve(response);
      }, function (err) {
        dfd.reject(err);
      });

    return dfd.promise;
  };

  authorRepo.getById = function (id) {
    var dfd = Q.defer();
    db.query('SELECT * FROM author WHERE id = ' + id).then(
      function (authors) {
        if (authors.length > 0) {
          dfd.resolve(authorModel.toJson(authors[0]));
        } else {
          dfd.reject('Author not found');
        }
      }, function (err) {
        console.log(error);
        dfd.reject(err);
      });

    return dfd.promise;
  };

  authorRepo.new = function () {
    var dfd = Q.defer(),
      query = 'INSERT INTO author (first_name, last_name) VALUES("", "")';

    db.query(query).then(
      function (result) {
        dfd.resolve(result.insertId);
      }, function (err) {
        console.log(err);
        dfd.reject(err);
      });

    return dfd.promise;
  };

  authorRepo.save = function (id, author) {
    var dfd = Q.defer();
    var query = "UPDATE author SET " +
      "first_name = " + dbPool.escape(author.firstName) + "," +
      "last_name = " + dbPool.escape(author.lastName) + " " +
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

  return authorRepo;
};

module.exports = repo;
