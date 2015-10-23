/* jshint -W117 */
var crypto = require('crypto'),
  conf = require('../config/conf'),
  Q = require('q');

function base64Encode(str) {
  /* jshint -W117 */
  return new Buffer(str).toString('base64');
}

function base64Decode(str) {
  /* jshint -W117 */
  return new Buffer(str, 'base64').toString();
}

function verify(rawSignature, signature, secret) {
  return signature == sign(rawSignature, secret);
}

function sign(str, key) {
  return crypto.createHmac('sha256', key).update(str).digest('base64');
}

function encode(payload) {
  var algorithm = 'HS256';

  var header = {
    typ: 'JWT',
    alg: algorithm
  };

  payload.iss = conf.jwt.issuer;

  var jwt = base64Encode(JSON.stringify(header)) + '.' + base64Encode(JSON.stringify(payload));
  var signature = sign(jwt, conf.jwt.secret);
  return jwt + '.' + signature;
}

function decode(token) {
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
}

exports.encode = encode;
exports.decode = decode;
exports.tokenFilter = function (req, dbPool) {
  var dfd = Q.defer();
  var userRepo = require('../repositories/user.repo')(dbPool);

  req.currentUser = false;
  if (req.headers.authorization && req.headers.authorization.split(' '.length > 1)) {
    var token = req.headers.authorization.split(' ')[1];
    var decodedToken = decode(token);
    if (decodedToken.payload.sub) {
      // Get the user and their roles
      userRepo.getById(decodedToken.payload.sub).then(
        function (user) {
          req.currentUser = user;
          // SETUP Easy Roles
          req.currentUser.hasAdminRole = req.currentUser.hasEditorRole = req.currentUser.hasReadRole = false;
          for (var i = 0; i < req.currentUser.roles.length; i++) {
            switch (req.currentUser.roles[i]) {
              case 'Admin':
                // ALL THE ROLES
                req.currentUser.hasAdminRole = true;
                req.currentUser.hasEditorRole = true;
                req.currentUser.hasReadRole = true;
                req.currentUser.hasLibrarianRole = true;
                break;
              case 'Editor':
                req.currentUser.hasEditorRole = true;
                req.currentUser.hasReadRole = true;
                break;
              case 'Read':
                req.currentUser.hasReadRole = true;
                break;
              case 'Librarian':
                req.currentUser.hasLibrarianRole = true;
                break;
            }
          }
          dfd.resolve();
        }, function () {
          dfd.resolve();
        });
    } else {
      dfd.resolve();
    }
  } else {
    dfd.resolve();
  }

  return dfd.promise;
};
