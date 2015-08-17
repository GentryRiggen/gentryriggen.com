/**
 * Created by gentryriggen on 8/11/15.
 */
var user = require('../models/user.model'),
  express = require('express');

var ctrl = function(dbPool) {
  var userCtrl = express.Router();

  userCtrl.route('/')
    .get(function(req, res) {
      if (req.currentUser) {
        return res.json(req.currentUser);
      } else {
        return res.status(401).send({error: 'Not logged in'});
      }
    });

  return userCtrl;
};

module.exports = ctrl;
