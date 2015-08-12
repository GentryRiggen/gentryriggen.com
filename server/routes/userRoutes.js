/**
 * Created by gentryriggen on 8/11/15.
 */
var express = require('express'),
  userCtrl = require('../controllers/user.ctrl');

var routes = function(dbPool) {
  var userRouter = express.Router();

  userRouter.route('/')
    .get(function(req, res) {
      userCtrl.getCurrentUser(req, res);
    });

  return userRouter;
};

module.exports = routes;
