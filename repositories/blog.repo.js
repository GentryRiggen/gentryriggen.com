/**
 * Created by gentryriggen on 8/11/15.
 */

var blogModel = require('../models/blog.model'),
  Q = require('q');

var repo = function(dbPool) {
  var blogRepo = {};
  var db = require('../services/db.service')(dbPool);

  blogRepo.getTotal = function(adminRequest) {
    var dfd = Q.defer(),
      whereVisible = adminRequest ? '1 = 1' : 'visible = 1';
    db.query('SELECT COUNT(id) as count FROM blog_post WHERE ' + whereVisible).then(
      function(results) {
        if (results.length > 0) {
          dfd.resolve(results[0].count);
        } else {
          dfd.resolve(0);
        }
      }, function(err) {
        dfd.reject(err);
      });

    return dfd.promise;
  };

  blogRepo.getAll = function(skip, take, adminRequest) {
    var dfd = Q.defer(),
      whereVisible = adminRequest ? '1 = 1' : 'visible = 1';

    db.query('SELECT * FROM blog_post WHERE ' + whereVisible + ' ORDER BY created_on DESC LIMIT ' + skip + ', ' + take).then(
      function(blogs) {
        var response = [];
        for (var i = 0; i < blogs.length; i++) {
          response.push(blogModel.toJson(blogs[i]));
        }
        dfd.resolve(response);
      }, function(err) {
        dfd.reject(err);
      });

    return dfd.promise;
  };

  blogRepo.getById = function(id) {
    var dfd = Q.defer();
    db.query('SELECT * FROM blog_post WHERE id = ' + id).then(
      function(blogs) {
        if (blogs.length > 0) {
          var b = blogs[0];
          dfd.resolve(blogModel.toJson(b));
        } else {
          dfd.reject('Blog Post not found');
        }
      }, function(err) {
        dfd.reject(err);
      });

    return dfd.promise;
  };

  return blogRepo;
};

module.exports = repo;
