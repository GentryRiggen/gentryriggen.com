/**
 * Created by gentryriggen on 8/11/15.
 */
var express = require('express'),
  user = require('../models/user');

var routes = function(dbPool) {
  var userRouter = express.Router();

  userRouter.use('/', function(req, res, next) {
    dbPool.getConnection(function(err, connection) {
      if (err) {
        dbError(res, connection);
      } else {
        req.dbConnection = connection;
        next();
      }
    });
  });
  userRouter.route('/')
    .get(function(req, res) {
      req.dbConnection.query('SELECT * FROM user', function(err, rows) {
          if (err) {
            dbError(res, dbConnection);
            return;
          }

          var response = [];
          for (var i = 0; i < rows.length; i++) {
            response.push(user.toJson(rows[i]));
          }

          req.dbConnection.release();
          res.json(response);
        });
      });

  return userRouter;
};

function dbError(res, connection) {
  connection.release();
  res.status(500).send('Error with DB');
}

module.exports = routes;
