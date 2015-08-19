/**
 * Created by gentryriggen on 8/11/15.
 */
var conf = require('../config/conf');
exports.toJson = function(fileName) {
  return {
    fileName: fileName,
    uri: conf.blobStorage.url + '/' + fileName
  };
};
