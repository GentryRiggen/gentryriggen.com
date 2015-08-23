(function () {
  'use strict';

  /* jshint -W117 */
  var express = require('express');

  var ctrl = function (dbPool) {
    var authCtrl = express.Router();
    var userRepo = require('../repositories/user.repo')(dbPool);

    authCtrl.route('/')
      .post(function (req, res) {
        userRepo.authorizeUser(req.body.username, req.body.password).then(
          function(user) {
            res.json(user);
          }, function() {
            res.status(401).send({message: 'Invalid username and/or password'});
          });
      });

    return authCtrl;
  };

  module.exports = ctrl;
})();
