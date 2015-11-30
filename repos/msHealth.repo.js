var conf = require('../config/conf'),
  Q = require('q'),
  mySqlDbPool = require('../mySqlDbPool'),
  userRepo = require('./user.repo')(mySqlDbPool),
  userWorkoutRepo = require('./userWorkout.repo'),
  userRunRepo = require('./userRun.repo'),
  userSleepRepo = require('./userSleep.repo'),
  userDailySummaryRepo = require('./userDailySummary.repo'),
  httpsService = require('../services/https.service'),
  apiToken, refreshToken;

function getMSHealthUserTokens() {
  var dfd = Q.defer();
  if (apiToken && refreshToken) {
    dfd.resolve();
  } else {
    userRepo.getById(conf.msftHealth.gentryId, true)
      .then(function (user) {
        apiToken = user.msHealthToken;
        refreshToken = user.msHealthRefreshToken;
        dfd.resolve();
      });
  }

  return dfd.promise;
}

function getAuthHeaders() {
  return {
    'Authorization': 'bearer ' + apiToken
  };
}

function getRefreshToken() {
  var dfd = Q.defer();
  var url = conf.msftHealth.refreshUrl
    .replace("{client_id}", conf.msftHealth.clientId)
    .replace("{redirect_uri}", conf.msftHealth.redirectUri)
    .replace("{client_secret}", conf.msftHealth.clientSecret)
    .replace("{refresh_token}", refreshToken)
    .replace("{grant_type}", conf.msftHealth.grantType);

  httpsService.get(url)
    .then(function (data) {
      apiToken = data.access_token;
      refreshToken = data.refresh_token;
      userRepo.createOrUpdate({
          id: conf.msftHealth.gentryId,
          mshealth_token: apiToken,
          mshealth_refresh_token: refreshToken
        }, false)
        .then(function () {
          dfd.resolve();
        })
        .catch(function (err) {
          dfd.reject(err);
        });
    })
    .catch(function (err) {
      dfd.reject(err);
    });

  return dfd.promise;
}

function ensureAuth() {
  var dfd = Q.defer();
  getMSHealthUserTokens()
    .then(function () {
      var url = conf.msftHealth.apiURL.replace("{path}", 'Profile').replace("{parameters}", '');
      httpsService.get(url, getAuthHeaders())
        .then(function (resp) {
          dfd.resolve(resp);
        })
        .catch(function () {
          getRefreshToken()
            .then(function () {
              dfd.resolve();
            })
            .catch(function (err) {
              dfd.reject(err);
            });
        });
    })
    .catch(function (err) {
      dfd.reject(err);
    });

  return dfd.promise;
}

function getParameters(parameters) {
  var queryParameters, p;
  queryParameters = "";

  if (parameters) {
    for (p in parameters) {
      if (parameters[p]) {
        queryParameters = queryParameters.concat(encodeURI(p) + "=" + encodeURI(parameters[p]) + "&");
      }
    }
  }

  return queryParameters.substring(0, queryParameters.length - 1);
}

function queryAPI(options) {
  var dfd = Q.defer();
  // Ensure we have user info
  ensureAuth()
    .then(function () {
      var queryParameters = options.parameters ? getParameters(options.parameters) : "";
      var url = conf.msftHealth.apiURL.replace("{path}", options.path).replace("{parameters}", queryParameters);

      httpsService.get(url, getAuthHeaders())
        .then(function (resp) {
          dfd.resolve(resp);
        })
        .catch(function (resp) {
          dfd.reject(resp);
        });
    })
    .catch(function (err) {
      dfd.reject(err);
    });

  return dfd.promise;
}

var msHealthRepo = {};

msHealthRepo.ensureStartAndEndTime = function (startTime, endTime) {
  if (!startTime) {
    startTime = new Date();
    startTime.setUTCHours(0, 0, 0, 0);
  }
  if (!endTime) {
    endTime = new Date(startTime.getTime());
    endTime.setUTCHours(23, 59, 59, 999);
  }

  return {
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString()
  };
};

msHealthRepo.getAllActivities = function (startTime, endTime) {
  var parameters = msHealthRepo.ensureStartAndEndTime(startTime, endTime);

  var options = {
    path: 'Activities',
    parameters: parameters
  };

  queryAPI(options)
    .then(function (resp) {
      if (resp.freePlayActivities) {
        resp.freePlayActivities.forEach(function (workout) {
          userWorkoutRepo.createIfDoesNotYetExist(workout);
        });
      }
      if (resp.runActivities) {
        resp.runActivities.forEach(function (run) {
          userRunRepo.createIfDoesNotYetExist(run);
        });
      }
      if (resp.sleepActivities) {
        resp.sleepActivities.forEach(function (sleep) {
          userSleepRepo.createIfDoesNotYetExist(sleep);
        });
      }
    });
};

msHealthRepo.getDailySummary = function (startTime, endTime) {
  var parameters = msHealthRepo.ensureStartAndEndTime(startTime, endTime);
  var options = {
    path: 'Summaries/Daily',
    parameters: parameters
  };

  queryAPI(options)
    .then(function (resp) {
      if (resp.summaries) {
        resp.summaries.forEach(function (dailySummary) {
          userDailySummaryRepo.createIfDoesNotYetExist(dailySummary);
        });
      }
    })
    .catch(function (resp) {
      console.log('Failed to get Daily Summaries', resp);
    });
};

msHealthRepo.sync = function (startTime, endTime) {
  msHealthRepo.getAllActivities(startTime, endTime);
  msHealthRepo.getDailySummary(startTime, endTime);
  var now = new Date();
  now = now.toMysqlFormat();
  userRepo.createOrUpdate({
    id: conf.msftHealth.gentryId,
    mshealth_last_update: now
  });
};

module.exports = msHealthRepo;
