/**
 * Created by gentryriggen on 8/11/15.
 */
var express = require('express');

var routes = function(dbPool) {
  var authRouter = express.Router();
  var authCtrl = require('../controllers/auth.ctrl')(dbPool);

  authRouter.route('/')
    .post(function(req, res) {
      authCtrl.login(req, res);
    });

  return authRouter;
};

module.exports = routes;
