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

exports.decode = function(token) {
  var segments = token.split('.');
  if (segments.length !== 3) {
    throw new Error('Token structure incorrect');
  }

  var header = JSON.parse(base64Decode(segments[0]));
  var payload = JSON.parse(base64Decode(segments[1]));

  var rawSignature = segments[0] + '.' + segments[1];
  if (!verify(rawSignature, segments[2], conf.jwt.secret)) {
    throw new Error('JWT Signature Verification Failed!');
  }

  return {
    header: header,
    payload: payload
  };
};

function sign(str, key) {
  return crypto.createHmac('sha256', key).update(str).digest('base64');
}

function base64Encode(str) {
  return new Buffer(str).toString('base64');
}

function base64Decode(str) {
  return new Buffer(str, 'base64').toString();
}

function verify(rawSignature, signature, secret) {
  return signature == sign(rawSignature, secret);
}
