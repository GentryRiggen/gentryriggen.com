/**
 * Created by gentryriggen on 8/11/15.
 */
var jwt = require('../services/jwt'),
  bcrypt = require('bcrypt-nodejs');

exports.toJson = function(user) {
  var payload = {
    sub: user.id
  };
  var token = jwt.encode(payload);

  return {
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    username: user.username,
    token: token
  }
};

exports.encryptPassword = function(password) {
  bcrypt.genSalt(10, function(err, salt) {
    if (err) {
      return false;
    }

    bcrypt.hash(password, salt, null, function(err, hash) {
      if (err) {
        return false;
      }

      return hash;
    });
  });
};
