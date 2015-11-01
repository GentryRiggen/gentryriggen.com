/* jshint -W117 */
var blogModel = require('../models/blog.model'),
  Q = require('q');

var repo = function (dbPool) {
  var blogRepo = {};
  var db = require('../services/db.service')(dbPool);

  blogRepo.getTotal = function (adminRequest) {
    var dfd = Q.defer(),
      whereVisible = adminRequest ? '1 = 1' : 'visible = 1';
    db.query('SELECT COUNT(id) as count FROM blog_post WHERE ' + whereVisible).then(
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

  blogRepo.getAll = function (skip, take, adminRequest) {
    var dfd = Q.defer(),
      whereVisible = adminRequest ? '1 = 1' : 'visible = 1';

    db.query('SELECT * FROM blog_post WHERE ' + whereVisible + ' ORDER BY visible_on DESC, created_on DESC LIMIT ' + skip + ', ' + take).then(
      function (blogs) {
        var response = [];
        for (var i = 0; i < blogs.length; i++) {
          response.push(blogModel.toJson(blogs[i]));
        }
        dfd.resolve(response);
      }, function (err) {
        dfd.reject(err);
      });

    return dfd.promise;
  };

  blogRepo.getById = function (id) {
    var dfd = Q.defer();
    db.query('SELECT * FROM blog_post WHERE id = ' + id).then(
      function (blogs) {
        if (blogs.length > 0) {
          var b = blogs[0];
          dfd.resolve(blogModel.toJson(b));
        } else {
          dfd.reject('Blog Post not found');
        }
      }, function (err) {
        dfd.reject(err);
      });

    return dfd.promise;
  };

  blogRepo.getByPermalink = function (permalink) {
    var dfd = Q.defer();
    db.query('SELECT * FROM blog_post WHERE permalink = "' + permalink + '"').then(
      function (blogs) {
        if (blogs.length > 0) {
          var b = blogs[0];
          dfd.resolve(blogModel.toJson(b));
        } else {
          dfd.reject('Blog Post not found');
        }
      }, function (err) {
        dfd.reject(err);
      });

    return dfd.promise;
  };

  blogRepo.save = function (id, blogPost) {
    var dfd = Q.defer(),
      updatedOn = new Date();
    updatedOn = updatedOn.toMysqlFormat();
    var query = "UPDATE blog_post SET " +
      "title = " + dbPool.escape(blogPost.title) + "," +
      "subtitle = " + dbPool.escape(blogPost.subtitle) + "," +
      "permalink = " + dbPool.escape(blogPost.permalink) + "," +
      "content = " + dbPool.escape(blogPost.content) + "," +
      "visible = " + blogPost.visible + "," +
      "updated_on = '" + updatedOn + "' " +
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

  blogRepo.new = function (userId) {
    var dfd = Q.defer(),
      date = new Date();
    date = date.toMysqlFormat();

    var query = "INSERT INTO blog_post VALUES(" +
      "DEFAULT, 'New Blog Post', 'subtitle', 'permalink', '<p>content</p>', 0, " + userId + ", " +
      "'" + date + "'," +
      "'" + date + "'," +
      "'" + date + "'" +
      ");";
    db.query(query).then(
      function (result) {
        dfd.resolve(result.insertId);
      }, function (err) {
        console.log(err);
        dfd.reject(err);
      });

    return dfd.promise;
  };

  blogRepo.deleteById = function (id) {
    var dfd = Q.defer(),
      query = "DELETE FROM blog_post WHERE id = " + id;
    db.query(query).then(
      function (result) {
        console.log("DELETE RESPONSE: ", result);
        dfd.resolve(result);
      }, function (err) {
        dfd.reject(err);
      });

    return dfd.promise;
  };

  return blogRepo;
};

module.exports = repo;
