/* jshint -W117 */
var bookModel = require('../models/book.model'),
  tableName = 'book',
  db = require('../db'),
  baseRepo = require('./base.repo')(tableName, bookModel),
  Q = require('q');

var bookRepo = {};
bookRepo.getById = function (id) {
  var dfd = Q.defer();
  var query = db.select('b.*', 'author.first_name', 'author.last_name')
    .from(tableName + ' as b')
    .leftJoin('author', 'b.author_id', 'author.id')
    .where('b.id', id)
    .first();
  query.then(function (book) {
    dfd.resolve(bookModel.toJson(book));
  }, function (err) {
    dfd.reject(err);
  });

  return dfd.promise;
};
bookRepo.createOrUpdate = baseRepo.createOrUpdate;
bookRepo.del = baseRepo.del;
bookRepo.getPaginatedParams = baseRepo.getPaginatedParams;

bookRepo.getTotal = function (frontPage) {
  var query = db.from(tableName).count('id as count');
  if (frontPage) {
    query = query.where('main_page', 1)
  }
  return query.first().then(function (result) {
    return result.count;
  });
};

bookRepo.getPaginated = function (skip, take, q, all) {
  var searchQuery = q.length ? '%' + q + '%' : false;
  var query = db.select('b.*', 'author.first_name', 'author.last_name').from(tableName + ' as b')
    .leftJoin('author', 'b.author_id', 'author.id');

  if (searchQuery) {
    query = query.where('b.title', 'LIKE', searchQuery)
      .orWhere('author.first_name', 'LIKE', searchQuery)
      .orWhere('author.last_name', 'LIKE', searchQuery);
  }

  if (!all) {
    query = query.where('b.have_read', 1);
  }

  query = query.orderBy('b.date_read', 'DESC')
    .orderBy('b.title')
    .orderBy('b.publish_date', 'DESC')
    .limit(take)
    .offset(skip);

  return query
    .then(function (books) {
      var response = [];
      books.forEach(function (book) {
        response.push(bookModel.toJson(book));
      });
      return response;
    });
};

module.exports = bookRepo;
