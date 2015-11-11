/* jshint -W117 */
var blogModel = require('../models/blog.model'),
  bookModel = require('../models/book.model'),
  db = require('../db'),
  tableName = 'blog_post';

var blogRepo = {
  getPaginatedParams: function (params) {
    var page = 'page' in params ? parseInt(params.page) : 1,
      pageSize = 'pageSize' in params ? parseInt(params.pageSize) : 5,
      skip = (page - 1) * pageSize;

    return {page: page, pageSize: pageSize, skip: skip};
  },

  getPaginated: function (skip, amount, adminRequest) {
    var whereVisible = adminRequest ? "1 = 1" : "visible = 1";
    query = "SELECT * FROM (" +
      "(SELECT TRUE AS isBook, FALSE AS isBlog, b.id AS id, FALSE AS permalink, b.title AS title, " +
      "CONCAT(a.last_name, ', ', a.first_name) AS subtitle, b.artwork_url AS img," +
      "b.rating AS rating, b.review AS content, b.date_read AS created_on, TRUE AS visible " +
      "FROM book b " +
      "LEFT JOIN author a ON (a.id = b.author_id) " +
      "WHERE b.have_read = 1) " +
      " UNION ALL " +
      "(SELECT FALSE AS isBook, TRUE  AS isBlog, id, permalink, title, subtitle, FALSE AS img, FALSE AS rating, content, created_on, visible " +
      "FROM blog_post " +
      "WHERE " + whereVisible + ") " +
      ") results " +
      "ORDER BY results.created_on DESC LIMIT ?, ?;";

    var dbQuery = db.raw(query, [skip, amount]);
    return dbQuery.then(function (results) {
      var modeledResults = [],
        i;
      for (i = 0; i < results[0].length; i++) {
        var result = results[0][i];
        if (result.isBook) {
          console.log('Book!', result.title);
          modeledResults.push(bookModel.toJson(result));
        } else if (result.isBlog) {
          console.log('Blog Post!', result.title);
          modeledResults.push(blogModel.toJson(result));
        }
      }

      return modeledResults;
    });

    //var query = db(tableName);
    //if (!adminRequest) {
    //  query.where('visible', 1);
    //}
    //query.orderBy('created_on', 'DESC').limit(amount).offset(skip);
    //return query.then(
    //  function (results) {
    //    var posts = [];
    //    results.forEach(function (post) {
    //      posts.push(blogModel.toJson(post));
    //    });
    //
    //    return posts;
    //  }
    //);
  },

  getTotal: function (adminRequest) {
    var query = db.from(tableName).count('id as count');
    if (!adminRequest) {
      query.where('visible', 1);
    }
    return query.first().then(function (result) {
      return result.count;
    });
  },

  getById: function (id) {
    return db(tableName).where('id', id).first().then(
      function (post) {
        return blogModel.toJson(post);
      });
  },

  getByPermalink: function (permalink) {
    return db(tableName).where('permalink', permalink).first().then(
      function (post) {
        return blogModel.toJson(post);
      });
  },

  createOrUpdate: function (blogPost) {
    var dbReadyPost = blogModel.fromJson(blogPost);
    var update = dbReadyPost.id > 0;
    delete dbReadyPost.id;
    var query = update ? db(tableName).where('id', blogPost.id).update(dbReadyPost) : db.insert(dbReadyPost).into(tableName).returning('id');
    return query.then(function (id) {
      return update ? null : blogRepo.getById(id);
    });
  },

  del: function (id) {
    return db(tableName).where('id', id).del();
  }
};

module.exports = blogRepo;
