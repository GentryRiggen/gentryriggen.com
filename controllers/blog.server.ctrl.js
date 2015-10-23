/* jshint -W117 */
var express = require('express');

var ctrl = function (dbPool) {
  var blogCtrl = express.Router();
  var blogRepo = require('../repositories/blog.repo')(dbPool);

  blogCtrl.route('/')
    .get(function (req, res) {
      var page = 'page' in req.query ? parseInt(req.query.page) : 1,
        pageSize = 'pageSize' in req.query ? parseInt(req.query.pageSize) : 5,
        skip = (page - 1) * pageSize,
        adminRequest = false;

      blogRepo.getTotal(false).then(
        function (total) {
          blogRepo.getAll(skip, pageSize, adminRequest).then(
            function (blogs) {
              res.json({
                posts: blogs,
                numPages: Math.ceil(total / req.query.pageSize),
                page: page,
                pageSize: pageSize
              });
            }, function (err) {
              console.log(err);
              res.status(500).send({error: 'Failed to get blog posts'});
            });
        }, function (err) {
          console.log(err);
          res.status(500).send({error: 'Failed to get blog posts'});
        });

    });

  blogCtrl.route('/:permalink')
    .get(function (req, res) {
      blogRepo.getByPermalink(req.params.permalink).then(
        function (blogPost) {
          res.json(blogPost);
        }, function () {
          res.status(500).send({error: 'Failed to get blog posts'});
        });
    });

  return blogCtrl;
};

module.exports = ctrl;
