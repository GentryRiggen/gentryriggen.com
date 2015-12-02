// REQUIRES
/* jshint -W117 */
var express = require('express'),
  jwt = require('./services/jwt.service'),
  bodyParser = require('body-parser'),
  path = require('path');


// ENVIRONMENT SETUP
console.log('NODE_ENV: ', process.env.NODE_ENV, process.env.PORT);
var app = express(),
  port = process.env.PORT || 8888,
  devMode = process.env.NODE_ENV === 'development';
app.use(bodyParser.json());

// DB CONNECTIONS

var dbPool = require('./mySqlDbPool');

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
app.use('/api/user', require('./controllers/user.server.ctrl')());
app.use('/api/blog', require('./controllers/blog.server.ctrl'));
app.use('/api/books', require('./controllers/books.server.ctrl')(dbPool));
app.use('/api/health', require('./controllers/health.server.ctrl'));
app.use('/api/admin/blog', require('./controllers/adminBlog.server.ctrl')());
app.use('/api/admin/files', require('./controllers/files.server.ctrl')());
app.use('/api/admin/accounts', require('./controllers/adminAccounts.server.ctrl')(dbPool));
app.use('/api/admin/books', require('./controllers/adminBooks.server.ctrl'));
app.use('/api/admin/authors', require('./controllers/adminAuthors.server.ctrl')(dbPool));

// SERVING UP CLIENT
if (devMode) {
  app.use(express.static(path.join(__dirname, 'client')));
  app.use(express.static(path.join(__dirname, 'client/.tmp/serve')));
  app.use(express.static(path.join(__dirname, 'client/src')));
} else {
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

Date.prototype.formatYearMonthDay = function () {
  return this.getUTCFullYear() + "-" + twoDigits(1 + this.getUTCMonth()) + "-" + twoDigits(this.getUTCDate());
};

if (!Date.prototype.toISOString) {
  (function() {

    function pad(number) {
      if (number < 10) {
        return '0' + number;
      }
      return number;
    }

    Date.prototype.toISOString = function() {
      return this.getUTCFullYear() +
        '-' + pad(this.getUTCMonth() + 1) +
        '-' + pad(this.getUTCDate()) +
        'T' + pad(this.getUTCHours()) +
        ':' + pad(this.getUTCMinutes()) +
        ':' + pad(this.getUTCSeconds()) +
        '.' + (this.getUTCMilliseconds() / 1000).toFixed(3).slice(2, 5) +
        'Z';
    };

  }());
}

// CRON
//  */10 * * * *
var CronJob = require('cron').CronJob;
var msHealthRepo = require('./repos/msHealth.repo');
var baseRepo = require('./repos/base.repo')();
new CronJob('*/1 * * * *', function() {
  var query = baseRepo.getStartAndEndQuery({});
  console.log('Syncing with MSFT Health', query);
  msHealthRepo.sync(query.startTime, query.endTime);
}, null, true, 'America/Denver');

// START THE APP
app.listen(port, function () {
  console.log('Listening on PORT: ', port);
});
