/**
 * Created by gentryriggen on 8/11/15.
 */
// REQUIRES
var express = require('express'),
  mysql = require('mysql'),
  conf = require('./config/conf'),
  jwt = require('./services/jwt.service'),
  Q = require('q'),
  bodyParser = require('body-parser'),
  path = require('path'),
  errorHandler = require('errorhandler');


// ENVIRONMENT SETUP
var app = express(),
  port = process.env.PORT || 8888;
app.use(bodyParser.json());

// DB CONNECTIONS
var dbPool = mysql.createPool(conf.databaseConfig);

// TOKEN FILTER
app.use('/api', function (req, res, next) {
  jwt.tokenFilter(req, dbPool).then(
    function(){
      next();
    }, function() {
      next();
    });
});

// ROUTES
app.use('/api/auth', require('./routes/authRoutes')(dbPool));
app.use('/api/user', require('./controllers/user.ctrl')(dbPool));
app.use('/api/blog', require('./routes/blogRoutes')(dbPool));

// SERVING UP CLIENT
if (app.get('env') === 'development') {
  console.log('Serving development environment', path.join(__dirname, 'client/.tmp'));
  app.use(express.static(path.join(__dirname, 'client')));
  app.use(express.static(path.join(__dirname, 'client/.tmp/serve')));
  app.use(express.static(path.join(__dirname, 'client/src')));
} else if (app.get('env') === 'production') {
  console.log('Serving production environment');
  app.use(express.static(path.join(__dirname, 'client/dist')));
}

// START THE APP
app.listen(port, function () {
  console.log('Listening on PORT: ', port);
});
