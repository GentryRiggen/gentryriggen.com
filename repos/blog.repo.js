/* jshint -W117 */
var blogModel = require('../models/blog.model'),
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
    var query = db(tableName);
    if (!adminRequest) {
      query.where('visible', 1);
    }
    query.orderBy('created_on', 'DESC').limit(amount).offset(skip);
    return query.then(
      function (results) {
        var posts = [];
        results.forEach(function (post) {
          posts.push(blogModel.toJson(post));
        });

        return posts;
      }
    );
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
