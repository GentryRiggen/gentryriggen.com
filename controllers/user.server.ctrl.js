(function () {
  'use strict';

  /* jshint -W117 */
  var express = require('express');

  var ctrl = function (dbPool) {
    console.log(dbPool.length);
    var userCtrl = express.Router();

    userCtrl.route('/')
      .get(function (req, res) {
        if (req.currentUser) {
          return res.json(req.currentUser);
        } else {
          return res.status(401).send({error: 'Not logged in'});
        }
      });

    return userCtrl;
  };

  module.exports = ctrl;
})();
