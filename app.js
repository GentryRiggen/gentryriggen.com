(function () {
  'use strict';

// REQUIRES
  /* jshint -W117 */
  var express = require('express'),
    mysql = require('mysql'),
    conf = require('./config/conf'),
    jwt = require('./services/jwt.service'),
    bodyParser = require('body-parser'),
    path = require('path');


// ENVIRONMENT SETUP
  var app = express(),
    port = process.env.PORT || 8888;
  app.use(bodyParser.json());

// DB CONNECTIONS
  var dbPool = mysql.createPool(conf.databaseConfig);

// TOKEN FILTER
  app.use('/api', function (req, res, next) {
    jwt.tokenFilter(req, dbPool).then(
      function () {
        next();
      }, function () {
        next();
      });
  });

// ROUTES
  app.use('/api/auth', require('./controllers/auth.server.ctrl.js')(dbPool));
  app.use('/api/user', require('./controllers/user.server.ctrl')(dbPool));
  app.use('/api/blog', require('./controllers/blog.server.ctrl')(dbPool));
  app.use('/api/admin/blog', require('./controllers/adminBlog.server.ctrl')(dbPool));
  app.use('/api/admin/files', require('./controllers/files.server.ctrl')());
  app.use('/api/admin/accounts', require('./controllers/adminAccounts.server.ctrl')(dbPool));
  app.use('/api/admin/books', require('./controllers/adminBooks.server.ctrl')(dbPool));

// SERVING UP CLIENT
  if (app.get('env') === 'development') {
    app.use(express.static(path.join(__dirname, 'client')));
    app.use(express.static(path.join(__dirname, 'client/.tmp/serve')));
    app.use(express.static(path.join(__dirname, 'client/src')));
  } else if (app.get('env') === 'production') {
    console.log('Serving production files');
    app.use(express.static(path.join(__dirname, 'client/dist')));
  }

// MISC
  function twoDigits(d) {
    if (0 <= d && d < 10) return "0" + d.toString();
    if (-10 < d && d < 0) return "-0" + (-1 * d).toString();
    return d.toString();
  }

  Date.prototype.toMysqlFormat = function () {
    return this.getUTCFullYear() + "-" + twoDigits(1 + this.getUTCMonth()) + "-" + twoDigits(this.getUTCDate()) + " " + twoDigits(this.getUTCHours()) + ":" + twoDigits(this.getUTCMinutes()) + ":" + twoDigits(this.getUTCSeconds());
  };

// START THE APP
  app.listen(port, function () {
    console.log('Listening on PORT: ', port);
  });
})();
