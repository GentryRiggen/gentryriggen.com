/**
 * Created by gentryriggen on 8/11/15.
 */

var blogModel = require('../models/blog.model'),
  Q = require('q');

var repo = function(dbPool) {
  var blogRepo = {};
  var db = require('../services/db.service')(dbPool);

  blogRepo.getAll = function(queryParams, adminRequest) {
    var dfd = Q.defer();
    var whereVisible = adminRequest ? '1 = 1' : 'visible = 1',
      page = 'page' in queryParams ? parseInt(queryParams.page) : 1,
      pageSize = 'pageSize' in queryParams ? parseInt(queryParams.pageSize) : 5,
      skip = (page - 1) * pageSize;

    console.log('QUERY: ', 'SELECT * FROM blog_post WHERE ' + whereVisible + ' ORDER BY created_on DESC LIMIT ' + skip + ', ' + pageSize);

    db.query('SELECT * FROM blog_post WHERE ' + whereVisible + ' ORDER BY created_on DESC LIMIT ' + skip + ', ' + pageSize).then(
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
