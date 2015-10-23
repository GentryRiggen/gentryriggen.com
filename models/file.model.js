/* jshint -W117 */
var conf = require('../config/conf');

/* jshint -W117 */
exports.toJson = function (fileName) {
  return {
    fileName: fileName,
    uri: conf.blobStorage.url + '/' + fileName
  };
};
