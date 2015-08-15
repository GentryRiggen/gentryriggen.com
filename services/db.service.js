/**
 * Created by gentryriggen on 8/11/15.
 */
var Q = require('q');

var db = function(dbPool) {
  var dbService = {};

  dbService.query = function(query) {
    var dfd = Q.defer();
    dbService.getConnection().then(
      function(connection) {
        connection.query(query, function(err, rows) {
          if (err) {
            connection.release();
            dfd.reject(err);
          } else {
            connection.release();
            dfd.resolve(rows);
          }
        });
      }, function(err) {
        dfd.reject(err);
      });

    return dfd.promise;
  };

  dbService.getConnection = function() {
    var dfd = Q.defer();
    dbPool.getConnection(function(err, connection) {
      if (err) {
        connection.release();
        dfd.reject(err);
      } else {
        dfd.resolve(connection);
      }
    });

    return dfd.promise;
  };

  return dbService;
};

module.exports = db;

exports.getConnection = function() {

};
