/* jshint -W117 */
var conf = require('../config/conf'),
  jpg = '.jpg',
  gif = '.gif',
  png = '.png';

function hasImageSuffix(fileName) {
  var file = fileName.toLowerCase();
  return (file.indexOf(jpg, fileName.length - jpg.length) !== -1) ||
    (file.indexOf(gif, fileName.length - gif.length) !== -1) ||
    (file.indexOf(png, fileName.length - png.length) !== -1);
}

/* jshint -W117 */
exports.toJson = function (fileName) {
  return {
    fileName: fileName,
    uri: conf.blobStorage.url + '/' + fileName,
    isImage: hasImageSuffix(fileName)
  };
};
