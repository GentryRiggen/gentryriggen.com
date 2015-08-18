/**
 * Created by gentryriggen on 8/11/15.
 */
var express = require('express'),
  blogModel = require('../models/blog.model');

var ctrl = function (dbPool) {
  var blogCtrl = express.Router();
  var blogRepo = require('../repositories/blog.repo')(dbPool);

  blogCtrl.use('/', function (req, res, next) {
    if (req.currentUser && req.currentUser.hasEditorRole) {
      next();
    } else {
      res.status(401).send({error: 'Unauthorized'});
    }
  });

  blogCtrl.route('/')
    .get(function (req, res) {
      console.log('Admin get all blog posts');
      var page = 'page' in req.query ? parseInt(req.query.page) : 1,
        pageSize = 'pageSize' in req.query ? parseInt(req.query.pageSize) : 5,
        skip = (page - 1) * pageSize,
        adminRequest = true;

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

  blogCtrl.route('/:id')
    .get(function (req, res) {
      console.log('Admin get blog post by id');
      blogRepo.getById(req.params.id).then(
        function (blogPost) {
          res.json(blogPost);
        }, function () {
          res.status(500).send({error: 'Failed to get blog posts'});
        });
    })
    .put(function (req, res) {
      blogRepo.save(req.params.id, req.body).then(
        function () {
          res.status(200).send({message: 'Blog post updated'});
        }, function () {
          res.status(500).send({error: 'Failed to save blog post'});
        });
    });

  return blogCtrl;
};

module.exports = ctrl;
