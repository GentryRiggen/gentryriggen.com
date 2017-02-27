/* jshint -W117 */
var conf = require('./config/conf'),
  devMode = process.env.DATA_ENV === 'development' || conf.devMode === true,
  knex = require('knex')(devMode ? conf.db.knex.development : conf.db.knex.production);

console.log('DB HOST ', devMode ? conf.db.knex.development.connection.host : conf.db.knex.production.connection.host);
knex.formatQuery = function(query) {
  return query.replace(/\n/g, ' ').replace(/\t/g, ' ');
};

module.exports = knex;
