/**
 * Created by gentryriggen on 8/11/15.
 */
var express = require('express'),
  blogModel = require('../models/blog.model');

var ctrl = function (dbPool) {
  var blogCtrl = express.Router();
  var blogRepo = require('../repositories/blog.repo')(dbPool);

  blogCtrl.route('/')
    .get(function (req, res) {
      var page = 'page' in req.query ? parseInt(req.query.page) : 1,
        pageSize = 'pageSize' in req.query ? parseInt(req.query.pageSize) : 5,
        skip = (page - 1) * pageSize;

      blogRepo.getTotal(false).then(
        function (total) {
          blogRepo.getAll(skip, pageSize, false).then(
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

  return blogCtrl;
};

module.exports = ctrl;
