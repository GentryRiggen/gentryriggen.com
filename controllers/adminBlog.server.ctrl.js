/* jshint -W117 */
var express = require('express'),
  Q = require('q');

var ctrl = function () {
  var blogCtrl = express.Router();
  var blogRepo = require('../repos/blog.repo');

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
      var params = blogRepo.getPaginatedParams(req.query);
      var totalPromise = blogRepo.getTotal(true);
      var getPaginatedPromise = blogRepo.getPaginated(params.skip, params.pageSize, true);
      Q.all([totalPromise, getPaginatedPromise]).then(
        function (results) {
          res.json({
            posts: results[1],
            numPages: Math.ceil(results[0] / params.pageSize),
            page: params.page,
            pageSize: params.pageSize
          });
        }, function (err) {
          console.log(err);
          res.status(500).send({error: 'Failed to get blog posts'});
        });
    })
    .post(function (req, res) {
      blogRepo.createOrUpdate({createdBy: req.currentUser.id})
        .then(
          function (blogPost) {
            res.json(blogPost);
          })
        .catch(function () {
          res.status(500).send({error: 'Failed to create new blog post'});
        });
    });

  blogCtrl.use('/:id', ensureAccess);
  blogCtrl.route('/:id')
    .get(function (req, res) {
      blogRepo.getById(req.params.id).then(
        function (blogPost) {
          res.json(blogPost);
        }, function () {
          res.status(500).send({error: 'Failed to get blog posts'});
        });
    })
    .put(function (req, res) {
      blogRepo.createOrUpdate(req.body).then(
        function () {
          res.status(204).send({message: 'Blog post updated'});
        }, function (err) {
          console.log(err);
          res.status(500).send({error: 'Failed to save blog post'});
        });
    })
    .delete(function (req, res) {
      blogRepo.del(req.params.id).then(
        function () {
          res.status(204).send({message: 'Blog post deleted'});
        }, function () {
          res.status(500).send({error: 'Failed to delete blog post'});
        });
    });

  return blogCtrl;
};

module.exports = ctrl;
