(function () {
  'use strict';

  /* jshint -W117 */
  var userModel = require('../models/user.model'),
    Q = require('q');

  var repo = function (dbPool) {
    var userRepo = {};
    var db = require('../services/db.service')(dbPool);

    userRepo.getAll = function () {
      var dfd = Q.defer();
      db.query('SELECT * FROM user').then(
        function (users) {
          var userModels = [];
          for (var i = 0; i < users.length; i++) {
            userModels.push(userModel.toJson(users[i]));
          }
          dfd.resolve(userModels);
        }, function (err) {
          dfd.reject(err);
        });

      return dfd.promise;
    };

    userRepo.getById = function (id) {
      var dfd = Q.defer();
      db.query('SELECT * FROM user WHERE id = ' + id).then(
        function (users) {
          if (users.length > 0) {
            var u = users[0];
            u = userModel.toJson(u);
            // Get user roles
            u.roles = [];
            db.query('SELECT r.title ' +
              'FROM user_role ur ' +
              'LEFT JOIN role r ON (r.id = ur.role_id)' +
              'WHERE ur.user_id = ' + u.id).then(
              function (roles) {
                for (var i = 0; i < roles.length; i++) {
                  u.roles.push(roles[i].title);
                }
                dfd.resolve(u);
              }, function (err) {
                dfd.reject(err);
              });
          } else {
            dfd.reject('User not found');
          }
        }, function (err) {
          dfd.reject(err);
        });

      return dfd.promise;
    };

    userRepo.getAllRoles = function () {
      var dfd = Q.defer();
      db.query('SELECT * FROM role').then(
        function (roles) {
          dfd.resolve(roles);
        }, function (err) {
          dfd.reject(err);
        });

      return dfd.promise;
    };

    userRepo.save = function (id, user) {
      var dfd = Q.defer();
      var query = "UPDATE user SET " +
        "first_name = '" + user.firstName + "'," +
        "last_name = '" + user.lastName + "'," +
        "email = '" + user.email + "'," +
        "username = '" + user.username + "'" +
        "WHERE id = " + id;
      db.query(query).then(
        function () {
          dfd.resolve();
        }, function (err) {
          console.log(err);
          dfd.reject(err);
        });

      return dfd.promise;
    };

    userRepo.updateUserPassword = function(id, password) {
      var dfd = Q.defer();
      userModel.encryptPassword(password).then(
        function(encryptedPass) {
          var query = "UPDATE user SET password = '" + encryptedPass + "'";
          db.query(query).then(
            function () {
              dfd.resolve();
            }, function (err) {
              console.log(err);
              dfd.reject(err);
            });
        }, function() {
          dfd.reject(err);
        });

      return dfd.promise;
    };

    userRepo.updateRoles = function (id, roles) {
      var dfd = Q.defer();
      // Remove all roles and then add new ones
      var query = "DELETE FROM user_role WHERE user_id = " + id;
      db.query(query).then(
        function () {
          // Add new roles if there are any
          if (roles && roles.length > 0) {
            // Insert new ones
            query = 'INSERT INTO user_role VALUES ';
            for (var i = 0; i < roles.length; i++) {
              query += '(DEFAULT, ' + id + ', ' + roles[i].id + ')';
              if (i != roles.length - 1) {
                query += ',';
              }
            }
            console.log('Inserting Roles', query);
            db.query(query).then(
              function () {
                dfd.resolve();
              }, function (err) {
                dfd.reject(err);
              });
          } else {
            dfd.resolve();
          }
        }, function (err) {
          console.log(err);
          dfd.reject(err);
        });

      return dfd.promise;
    };

    userRepo.authorizeUser = function(username, password) {
      var dfd = Q.defer();
      db.query('SELECT * FROM user WHERE username = "' + username + '"').then(
        function (users) {
          if (users.length > 0) {
            userModel.checkPassword(password, users[0].password).then(
              function () {
                userRepo.getById(users[0].id).then(
                  function (user) {
                    dfd.resolve(user);
                  }, function (err) {
                    dfd.reject(err);
                  });
              }, function (err) {
                dfd.reject(err);
              });
          } else {
            dfd.reject('Could not find any matching users');
          }
        }, function (err) {
          dfd.reject(err);
        });

      return dfd.promise;
    };

    return userRepo;
  };

  module.exports = repo;
})();
