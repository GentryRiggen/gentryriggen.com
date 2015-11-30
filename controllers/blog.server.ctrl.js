/* jshint -W117 */
var express = require('express'),
  Q = require('q'),
  blogCtrl = express.Router(),
  blogRepo = require('../repos/blog.repo'),
  msHealthRepo = require('../repos/msHealth.repo');

blogCtrl.route('/')
  .get(function (req, res) {
    var startTime = new Date();
    startTime.setDate(startTime.getDate() - 1);
    startTime.setUTCHours(0, 0, 0, 0);
    console.log(startTime);
    msHealthRepo.sync(startTime);

    var params = blogRepo.getPaginatedParams(req.query);

    var totalPromise = blogRepo.getTotalBlogsAndBooks();
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


module.exports = blogCtrl;
