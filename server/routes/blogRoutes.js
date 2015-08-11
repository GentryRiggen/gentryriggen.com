/**
 * Created by gentryriggen on 8/11/15.
 */
var express = require('express');

var routes = function() {
  var blogRouter = express.Router();

  blogRouter.route('/')
    .get(function(req, res) {
      var responseJson = {
        title: 'Hello, World',
        subtitle: 'Yep',
        content: 'Yo bro this is a blog post. Yo bro this is a blog post. Yo bro this is a blog post.'
      };

      res.json(responseJson);
    });

  return blogRouter;
};

module.exports = routes;
