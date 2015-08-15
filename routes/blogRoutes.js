/**
 * Created by gentryriggen on 8/11/15.
 */
var express = require('express');

var routes = function(dbPool) {
  var blogRouter = express.Router(),
    blogCtrl = require('../controllers/blog.ctrl')(dbPool);

  blogRouter.route('/')
    .get(function(req, res) {
      return blogCtrl.get(req, res);
    });

  return blogRouter;
};

module.exports = routes;
