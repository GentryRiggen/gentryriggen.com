const slackTerminal = require('slack-terminalize');
require('./slackbot/app');
const config = require('./config/conf');
// REQUIRES
/* jshint -W117 */
var express = require('express'),
  jwt = require('./services/jwt.service'),
  bodyParser = require('body-parser'),
  path = require('path');


// ENVIRONMENT SETUP
console.log('NODE_ENV: ', process.env.NODE_ENV, process.env.PORT);
var app = express(),
  port = config.usePort || 8888,
  devMode = process.env.NODE_ENV === 'development';
app.use(bodyParser.json());

// DB CONNECTIONS

var dbPool = require('./mySqlDbPool');

// TOKEN FILTER
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
  res.setHeader('Access-Control-Allow-Credentials', true);
  next();
});
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
app.use('/api/user', require('./controllers/user.server.ctrl')());
app.use('/api/blog', require('./controllers/blog.server.ctrl'));
app.use('/api/books', require('./controllers/books.server.ctrl')(dbPool));
app.use('/api/health', require('./controllers/health.server.ctrl'));
app.use('/api/admin/blog', require('./controllers/adminBlog.server.ctrl')());
app.use('/api/admin/files', require('./controllers/files.server.ctrl')());
app.use('/api/admin/accounts', require('./controllers/adminAccounts.server.ctrl')(dbPool));
app.use('/api/admin/books', require('./controllers/adminBooks.server.ctrl'));
app.use('/api/admin/authors', require('./controllers/adminAuthors.server.ctrl')(dbPool));
app.use('/api/slack', require('./slackbot/server/slack.server.ctrl'));

// SERVING UP CLIENT
if (devMode) {
  app.use(express.static(path.join(__dirname, 'client/public')));
} else {
  app.use(express.static(path.join(__dirname, 'client/build')));
}

// START THE APP
app.listen(port, function () {
  console.log('Listening on PORT: ', port);
});

// MISC
function twoDigits(d) {
  if (0 <= d && d < 10) return "0" + d.toString();
  if (-10 < d && d < 0) return "-0" + (-1 * d).toString();
  return d.toString();
}


Date.prototype.toMysqlFormat = function () {
  return this.getUTCFullYear() + "-" + twoDigits(1 + this.getUTCMonth()) + "-" + twoDigits(this.getUTCDate()) + " " + twoDigits(this.getUTCHours()) + ":" + twoDigits(this.getUTCMinutes()) + ":" + twoDigits(this.getUTCSeconds());
};

Date.prototype.toLocalMysqlFormat = function () {
  return this.getFullYear() + "-" + twoDigits(1 + this.getMonth()) + "-" + twoDigits(this.getDate()) + " " + twoDigits(this.getHours()) + ":" + twoDigits(this.getMinutes()) + ":" + twoDigits(this.getSeconds());
};

Date.prototype.formatLocalYearMonthDay = function () {
  return this.getFullYear() + "-" + twoDigits(1 + this.getMonth()) + "-" + twoDigits(this.getDate());
};

Date.prototype.toISOLocalString = function () {
  var tzo = -this.getTimezoneOffset(),
    dif = tzo >= 0 ? '+' : '-',
    pad = function(num) {
      var norm = Math.abs(Math.floor(num));
      return (norm < 10 ? '0' : '') + norm;
    };

  var isoLocalString = this.getFullYear();
  isoLocalString += '-' + pad(this.getMonth()+1);
  isoLocalString += '-' + pad(this.getDate());
  isoLocalString += 'T' + pad(this.getHours());
  isoLocalString += ':' + pad(this.getMinutes());
  isoLocalString += ':' + pad(this.getSeconds());
  isoLocalString += dif + pad(tzo / 60);
  isoLocalString += ':' + pad(tzo % 60);
  return isoLocalString;
};
