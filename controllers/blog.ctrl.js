/**
 * Created by gentryriggen on 8/11/15.
 */
var blogModel = require('../models/blog.model');

var ctrl = function(dbPool) {
  var blogCtrl = {};
  var blogRepo = require('../repositories/blog.repo')(dbPool);

  blogCtrl.get = function(req, res) {
    blogRepo.getAll(req.query, false).then(
      function(blogs) {
        res.json(blogs);
      }, function(err) {
        console.log(err);
        res.status(500).send({error: 'Failed to get blog posts'});
      });
  };

  return blogCtrl;
};

module.exports = ctrl;
