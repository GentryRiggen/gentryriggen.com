/**
 * Created by gentryriggen on 8/11/15.
 */
var jwt = require('../services/jwt.service'),
  bcrypt = require('bcrypt-nodejs'),
  Q = require('q'),
  conf = require('../config/conf');

exports.toJson = function(user) {
  var token = jwt.encode({
    sub: user.id
  });

  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    username: user.username,
    token: token,
    roles: user.roles
  }
};

exports.encryptPassword = function(password) {
  var dfd = Q.defer();
  bcrypt.genSalt(10, function(err, salt) {
    if (err) {
      dfd.reject(err);
    } else {
      bcrypt.hash(password, salt, null, function(err, hash) {
        if (err) {
          dfd.reject();
        } else {
          dfd.resolve(hash);
        }
      });
    }
  });

  return dfd.promise;
};

exports.checkPassword = function(attemptPw, hashedPw) {
  var dfd = Q.defer();

  bcrypt.compare(attemptPw, hashedPw, function(err, res) {
    if (err) {
      dfd.reject(err);
    } else {
      res ? dfd.resolve(res) : dfd.reject(res);
    }
  });

  return dfd.promise;
};
