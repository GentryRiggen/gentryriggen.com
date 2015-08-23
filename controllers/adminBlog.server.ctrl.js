(function () {
  'use strict';

  /* jshint -W117 */
  var express = require('express');

  var ctrl = function (dbPool) {
    var blogCtrl = express.Router();
    var blogRepo = require('../repositories/blog.repo')(dbPool);

    function ensureAccess(req, res, next) {
      if (req.currentUser && req.currentUser.hasEditorRole) {
        next();
      } else {
        res.status(401).send({error: 'Unauthorized'});
      }
    }

    blogCtrl.use('/', ensureAccess);
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

      })
      .post(function (req, res) {
        console.log('Creating new blog post');
        blogRepo.new(req.currentUser.id).then(
          function (newBlogPostId) {
            blogRepo.getById(newBlogPostId).then(
              function (newBlogPost) {
                res.json(newBlogPost);
              }, function (err) {
                console.log(err);
                res.status(500).send({error: 'Failed to create new blog post'});
              });
          }, function (err) {
            console.log(err);
            res.status(500).send({error: 'Failed to create new blog post'});
          });
      });

    blogCtrl.use('/:id', ensureAccess);
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
            res.status(204).send({message: 'Blog post updated'});
          }, function () {
            res.status(500).send({error: 'Failed to save blog post'});
          });
      })
      .delete(function (req, res) {
        blogRepo.deleteById(req.params.id).then(
          function () {
            res.status(204).send({message: 'Blog post deleted'});
          }, function () {
            res.status(500).send({error: 'Failed to delete blog post'});
          });
      });

    return blogCtrl;
  };

  module.exports = ctrl;
})();
