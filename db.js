/* jshint -W117 */
var conf = require('./config/conf'),
  devMode = process.env.NODE_ENV === 'development',
  knex = require('knex')(devMode ? conf.db.knex.development : conf.db.knex.production);
module.exports = knex;
