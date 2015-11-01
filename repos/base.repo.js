var Q = require('q');

var repo = function (dbPool, tableName, model) {
  var baseRepo = {};
  var db = require('../services/db.service')(dbPool);

  baseRepo.getById = function (id) {
    var dfd = Q.defer();
    db.query('SELECT * FROM `' + tableName/* + '` WHERE id = ' + id*/).then(
      function (results) {
        if (results.length > 0) {
          dfd.resolve(model.toJson(results[0]));
        } else {
          dfd.reject('Not Found');
        }
      }, function (err) {
        dfd.reject(err);
      });

    return dfd.promise;
  };

  baseRepo.new = function (data) {
    var dfd = Q.defer();
    var insertStmt = "INSERT INTO `" + tableName + "` (";
    var prop;
    for (prop in data) {
      insertStmt += "`" + prop + "`,";
    }
    insertStmt = insertStmt.substring(0, insertStmt.length - 1);
    insertStmt += ") VALUES(";
    for (prop in data) {
      insertStmt += "'" + data[prop] + "',";
    }
    insertStmt = insertStmt.substring(0, insertStmt.length - 1);
    insertStmt += ");";
    db.query(insertStmt).then(
      function (result) {
        console.log('Insert result', result, tableName);
        baseRepo.getById(result.insertId).then(
          function (newItem) {
            dfd.resolve(newItem);
          }, function (err) {
            dfd.reject(err);
          });
      }, function (err) {
        dfd.reject(err);
      });
    return dfd.promise;
  };

  return baseRepo;
};

module.exports = repo;
