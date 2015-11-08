/* jshint -W117 */
var userModel = require('../models/user.model'),
  Q = require('q'),
  tableName = 'user',
  db = require('../db'),
  util = require('../services/util.service');

var repo = function () {
  var userRepo = {};

  userRepo.getAll = function () {
    return db(tableName).then(
      function (users) {
        var userModels = [];
        for (var i = 0; i < users.length; i++) {
          userModels.push(userModel.toJson(users[i]));
        }
        return userModels;
      });
  };

  userRepo.getUserRoles = function (userId) {
    var query = db('role as r')
      .select('r.title')
      .joinRaw('JOIN user_role ur ON ur.role_id = r.id AND ur.user_id = ?', userId);

    return query.then(function (results) {
      var roles = [];
      results.forEach(function (role) {
        roles.push(role.title);
      });
      return roles;
    });
  };

  userRepo.getById = function (id) {
    var userPromise = db(tableName)
      .select('id', 'first_name', 'last_name', 'email', 'username')
      .where('id', id).first().then();
    var userRoles = userRepo.getUserRoles(id);
    return Q.all([userPromise, userRoles]).then(function (results) {
      var user = userModel.toJson(results[0]);
      user.roles = results[1];
      return user;
    });
  };

  userRepo.getAllRoles = function () {
    return db('role').then();
  };

  userRepo.createOrUpdate = function (user) {
    var dbReadyUser = userModel.fromJson(user);
    var update = dbReadyUser.id > 0;
    delete dbReadyUser.id;
    var query = update ? db(tableName).where('id', user.id).update(dbReadyUser) : db.insert(dbReadyUser).into(tableName).returning('id');
    console.log('userRepo.createOrUpdate query', query.toString());
    return query.then(function (id) {
      return update ? null : userRepo.getById(id);
    });
  };

  userRepo.updateUserPassword = function (id, password) {
    var dfd = Q.defer();
    function catchError(err) {
      dfd.reject(err);
    }
    userModel.encryptPassword(password)
      .then(function (encryptedPass) {
        db(tableName).where('id', id).update({password: encryptedPass})
          .then(function() {
            dfd.resolve();
          }).catch(catchError);
      }).catch(catchError);

    return dfd.promise;
  };

  userRepo.updateRoles = function (id, roles) {
    return db('user_role').where('user_id', id).del()
      .then(function() {
        var roleIds = [];
        roles.forEach(function(role) {
          roleIds.push(role.id);
        });
        var userRoles = util.idToMMObjArr('role_id', roleIds, 'user_id', id);
        return db('user_role').insert(userRoles).then();
      });
  };

  userRepo.authorizeUser = function (username, password) {
    var dfd = Q.defer();
    db(tableName).select('id', 'password')
      .where('username', username).first()
      .then(function (user) {
        userModel.checkPassword(password, user.password)
          .then(function () {
            userRepo.getById(user.id)
              .then(function (userModel) {
                dfd.resolve(userModel);
              })
              .catch(function (err) {
                dfd.reject(err);
              });
          })
          .catch(function (err) {
            dfd.reject(err);
          });
      })
      .catch(function (err) {
        dfd.reject(err);
      });

    return dfd.promise;
  };

  return userRepo;
};

module.exports = repo;
