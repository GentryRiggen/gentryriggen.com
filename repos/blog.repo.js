/* jshint -W117 */
var blogModel = require('../models/blog.model'),
  bookModel = require('../models/book.model'),
  bookRepo = require('./book.repo'),
  db = require('../db'),
  multiline = require('multiline'),
  tableName = 'blog_post',
  baseRepo = require('./base.repo')(tableName, blogModel),
  Q = require('q');

var blogRepo = {};
blogRepo.getById = baseRepo.getById;
blogRepo.createOrUpdate = baseRepo.createOrUpdate;
blogRepo.del = baseRepo.del;
blogRepo.getPaginatedParams = baseRepo.getPaginatedParams;

blogRepo.getPaginated = function (skip, amount, adminRequest) {
  if (adminRequest) {
    return db(tableName).orderBy('created_on', 'DESC').limit(amount).offset(skip)
      .then(function (books) {
        var results = [];
        books.forEach(function (book) {
          results.push(bookModel.toJson(book));
        });
        return results;
      });
  } else {
    var query = multiline.stripIndent(function () {/*
     SELECT *
     FROM (
        (SELECT
          TRUE AS isBook, FALSE AS isBlog, b.id, FALSE AS permalink, b.title,
          CONCAT(a.last_name, ', ', a.first_name) AS subtitle, a.first_name, a.last_name,
          b.artwork_url, b.rating, b.review AS content, b.date_read AS created_on
        FROM book b
        LEFT JOIN author a ON (a.id = b.author_id)
        WHERE b.have_read = 1 && b.main_page = 1)
        UNION ALL
        (SELECT
          FALSE AS isBook, TRUE  AS isBlog, id, permalink, title, '' as first_name, '' as last_name,
          subtitle, FALSE AS artwork_url, FALSE AS rating, content, created_on
        FROM blog_post
        WHERE visible = 1)
     ) results
     ORDER BY results.created_on DESC
     LIMIT ?, ?
     */});
    query = db.formatQuery(query);
    return db.raw(query, [skip, amount]).then(function (results) {
      var modeledResults = [],
        i;
      for (i = 0; i < results[0].length; i++) {
        var result = results[0][i];
        if (result.isBook) {
          var book = bookModel.toJson(result);
          book.isBook = true;
          modeledResults.push(book);
        } else if (result.isBlog) {
          var blog = blogModel.toJson(result);
          blog.isBlog = true;
          modeledResults.push(blog);
        }
      }

      return modeledResults;
    });
  }
};

blogRepo.getTotal = function (adminRequest) {
  var query = db.from(tableName).count('id as count');
  if (!adminRequest) {
    query.where('visible', 1);
  }
  return query.first().then(function (result) {
    return result.count;
  });
};

blogRepo.getTotalBlogsAndBooks = function() {
  var dfd = Q.defer();
  var getTotalBlogPosts = blogRepo.getTotal();
  var getTotalBooks = bookRepo.getTotal(true);

  Q.all([getTotalBlogPosts, getTotalBooks]).then(
    function(results) {
      dfd.resolve(results[0] + results[1]);
    }
  );

  return dfd.promise;
};

blogRepo.getByPermalink = function (permalink) {
  return db(tableName).where('permalink', permalink).first().then(
    function (post) {
      return blogModel.toJson(post);
    });
};

module.exports = blogRepo;
