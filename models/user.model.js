/* jshint -W117 */
var jwt = require('../services/jwt.service'),
  bcrypt = require('bcrypt-nodejs'),
  Q = require('q');

exports.toJson = function (user) {
  var token = jwt.encode({
    sub: user.id
  });

  var userModel = {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    username: user.username,
    token: token,
    roles: []
  };

  return userModel;
};

exports.fromJson = function (user) {
  return {
    id: ('id' in user) ? user.id : 0,
    first_name: ('firstName' in user) ? user.firstName : "",
    last_name: ('lastName' in user) ? user.lastName : "",
    email: ('email' in user) ? user.email : "",
    username: ('username' in user) ? user.username : ""
  };
};

exports.encryptPassword = function (password) {
  var dfd = Q.defer();
  bcrypt.genSalt(10, function (err, salt) {
    if (err) {
      dfd.reject(err);
    } else {
      bcrypt.hash(password, salt, null, function (err, hash) {
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

exports.checkPassword = function (attemptPw, hashedPw) {
  var dfd = Q.defer();

  bcrypt.compare(attemptPw, hashedPw, function (err, res) {
    if (err) {
      dfd.reject(err);
    } else {
      if (res) {
        dfd.resolve(res);
      } else {
        dfd.reject(res);
      }
    }
  });

  return dfd.promise;
};
