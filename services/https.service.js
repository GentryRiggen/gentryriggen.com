/* jshint -W117 */
var Q = require('q'),
  https = require('https'),
  url = require('url');

var httpsService = {};
httpsService.get = function (requestUrl, headers) {
  var dfd = Q.defer();

  var parsedUrl = url.parse(requestUrl);
  var options = {
    host: parsedUrl.host,
    path: parsedUrl.path,
    port: 443
  };
  if (headers) {
    options.headers = headers;
  }

  https.get(options, function (res) {
    var body = '';
    res.on('data', function (chunk) {
      body += chunk;
    });
    res.on('end', function () {
      try {
        body = JSON.parse(body);
        if (body.error) {
          body.error.status = res.statusCode;
          dfd.reject(body.error);
        } else {
          dfd.resolve(body);
        }
      } catch (e) {
        dfd.reject(e);
      }
    });
  }).on('error', function (err) {
      err.status = res.statusCode;
    dfd.reject(err);
  });

  return dfd.promise;
};
module.exports = httpsService;
