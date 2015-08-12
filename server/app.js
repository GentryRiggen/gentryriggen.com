/**
 * Created by gentryriggen on 8/11/15.
 */
// REQUIRES
var express = require('express'),
  mysql = require('mysql'),
  conf = require('./config/conf'),
  jwt = require('./services/jwt.service'),
  Q = require('q'),
  bodyParser = require('body-parser');

// ENVIRONMENT SETUP
var app = express();
var port = process.env.PORT || 3000;
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
app.use('/api/user', require('./routes/userRoutes')(dbPool));
app.use('/api/blog', require('./routes/blogRoutes')());

// START THE APP
app.listen(port, function () {
  console.log('Listening on PORT: ', port);
});
