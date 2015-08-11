/**
 * Created by gentryriggen on 8/11/15.
 */
var crypto = require('crypto'),
  conf = require('../config/conf');

exports.encode = function(payload) {
  var algorithm = 'HS256';

  var header = {
    typ: 'JWT',
    alg: algorithm
  };

  payload.iss = conf.jwt.issuer;

  var jwt = base64Encode(JSON.stringify(header)) + '.' + base64Encode(JSON.stringify(payload));
  var signature = sign(jwt, conf.jwt.secret);
  return jwt + '.' + signature;
};

function sign(str, key) {
  return crypto.createHmac('sha256', key).update(str).digest('base64');
}

function base64Encode(str) {
  return new Buffer(str).toString('base64');
}
