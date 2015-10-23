/* jshint -W117 */
var express = require('express');

var ctrl = function (dbPool) {
  var accountsCtrl = express.Router();
  var userRepo = require('../repositories/user.repo')(dbPool);

  function ensureAccess(req, res, next) {
    if (req.currentUser && req.currentUser.hasAdminRole) {
      next();
    } else {
      res.status(401).send({error: 'Unauthorized'});
    }
  }

  accountsCtrl.use('/', ensureAccess);
  accountsCtrl.route('/')
    .get(function (req, res) {
      userRepo.getAll().then(
        function (users) {
          res.json(users);
        }, function () {
          res.status(500).send({message: 'Failed to get accounts'});
        });
    });
  accountsCtrl.use('/:id', ensureAccess);
  accountsCtrl.route('/:id')
    .get(function (req, res) {
      userRepo.getById(req.params.id).then(
        function (user) {
          userRepo.getAllRoles().then(
            function (roles) {
              res.json({
                user: user,
                roles: roles
              });
            }, function (err) {
              console.log(err);
              res.status(500).send({message: 'Failed to get roles'});
            });
        }, function (err) {
          console.log(err);
          res.status(500).send({message: 'Failed to get account'});
        });
    })
    .put(function (req, res) {
      userRepo.save(req.params.id, req.body).then(
        function () {
          res.status(200).send({message: 'Updated account info'});
        }, function (err) {
          console.log(err);
          res.status(500).send({message: 'Failed to update account'});
        });
    });

  accountsCtrl.use('/:id/password', ensureAccess);
  accountsCtrl.route('/:id/password')
    .put(function (req, res) {
      if (req.body.password.length < 6) {
        res.status(400).send({message: 'Password not long enough'});
      } else {
        userRepo.updateUserPassword(req.params.id, req.body.password).then(
          function () {
            res.status(200).send({message: 'Updated account password'});
          }, function (err) {
            console.log(err);
            res.status(500).send({message: 'Failed to update account password'});
          });
      }
    });

  accountsCtrl.use('/:id/roles', ensureAccess);
  accountsCtrl.route('/:id/roles')
    .put(function (req, res) {
      userRepo.updateRoles(req.params.id, req.body).then(
        function () {
          res.status(200).send({message: 'Updated account roles'});
        }, function (err) {
          console.log(err);
          res.status(500).send({message: 'Failed to update account roles'});
        });
    });

  return accountsCtrl;
};

module.exports = ctrl;
