(function () {
  'use strict';

  /* jshint -W117 */
  var userModel = require('../models/user.model'),
    Q = require('q');

  var repo = function (dbPool) {
    var userRepo = {};
    var db = require('../services/db.service')(dbPool);

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

    return userRepo;
  };

  module.exports = repo;
})();
