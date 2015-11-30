/* jshint -W117 */
var conf = require('./config/conf'),
  mysql = require('mysql'),
  devMode = process.env.NODE_ENV === 'development',
  dbPool = mysql.createPool(devMode ? conf.db.mysql.development : conf.db.mysql.production);

module.exports = dbPool;
