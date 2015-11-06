/* jshint -W117 */
var express = require('express'),
  Q = require('q');

var ctrl = function () {
  var blogCtrl = express.Router();
  var blogRepo = require('../repos/blog.repo');

  blogCtrl.route('/')
    .get(function (req, res) {
      var params = blogRepo.getPaginatedParams(req.query);

      var totalPromise = blogRepo.getTotal(false);
      var getPaginatedPromise = blogRepo.getPaginated(params.skip, params.pageSize, false);
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
