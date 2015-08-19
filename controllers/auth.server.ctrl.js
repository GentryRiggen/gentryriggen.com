/**
 * Created by gentryriggen on 8/11/15.
 */
var express = require('express'),
  userModel = require('../models/user.model');

var ctrl = function(dbPool) {
  var authCtrl = express.Router();
  var db = require('../services/db.service')(dbPool);

  authCtrl.route('/')
    .post(function(req, res) {
      console.log("Auth Request", req.body);
      db.query('SELECT * FROM user WHERE username = "' + req.body.username + '"').then(
        function(users) {
          console.log('Matching users', users);
          if (users.length > 0) {
            userModel.checkPassword(req.body.password, users[0].password).then(
              function() {
                var userRepo = require('../repositories/user.repo')(dbPool);
                var user = userRepo.getById(users[0].id).then(
                  function(user) {
                    return res.json(userModel.toJson(user));
                  }, function(err) {
                    return res.status(500).send({error: err});
                  });
              }, function(err) {
                return res.status(500).send({error: err});
              });

          } else {

          }
        }, function(err) {
          return res.status(500).send({error: err});
        });
    });

  return authCtrl;
};

module.exports = ctrl;
