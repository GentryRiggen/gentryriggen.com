var conf = require('../config/conf'),
  Q = require('q'),
  mySqlDbPool = require('../mySqlDbPool'),
  baseRepo = require('./base.repo')(),
  userRepo = require('./user.repo')(mySqlDbPool),
  userWorkoutRepo = require('./userWorkout.repo'),
  userRunRepo = require('./userRun.repo'),
  userSleepRepo = require('./userSleep.repo'),
  userDailySummaryRepo = require('./userDailySummary.repo'),
  dailySummaryHourRepo = require('./dailySummaryHour.repo'),
  dailySummaryHourModel = require('../models/dailySummaryHour.model'),
  httpsService = require('../services/https.service'),
  db = require('../db'),
  _ = require('lodash'),
  moment = require('moment'),
  apiToken, refreshToken;

require('moment-timezone');

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

msHealthRepo.getAllActivities = function (startTime, endTime) {
  var params = baseRepo.ensureStartAndEndTime(startTime, endTime, true);
  params.activityIncludes = 'Details,MinuteSummaries,MapPoints';

  var options = {
    path: 'Activities',
    parameters: params
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
  var dfd = Q.defer();
  var params = baseRepo.ensureStartAndEndTime(startTime, endTime, true);
  var options = {
    path: 'Summaries/Daily',
    parameters: params
  };

  queryAPI(options)
    .then(function (resp) {
      if (resp.summaries) {
        resp.summaries.forEach(function (dailySummary) {
          userDailySummaryRepo.createIfDoesNotYetExist(dailySummary);
        });

        dfd.resolve();
      }
    })
    .catch(function (resp) {
      console.log('Failed to get Daily Summaries', resp);
      dfd.reject();
    });

  return dfd.promise;
};

msHealthRepo.getDailySummaryHour = function (startTime, endTime) {
  var params = baseRepo.ensureStartAndEndTime(startTime, endTime, true);
  var options = {
    path: 'Summaries/Hourly',
    parameters: params
  };

  queryAPI(options)
    .then(function (resp) {
      if (resp.summaries) {
        resp.summaries.forEach(function (hourSummary) {
          dailySummaryHourRepo.createIfDoesNotYetExist(hourSummary);
        });
      }
    })
    .catch(function (resp) {
      console.log('Failed to get Daily Summary Hours', resp);
    });
};

msHealthRepo.sync = function (startTime, endTime) {
  msHealthRepo.getAllActivities(startTime, endTime);
  msHealthRepo.getDailySummary(startTime, endTime)
    .then(function () {
      msHealthRepo.getDailySummaryHour(startTime, endTime);
    });
  var now = new Date();
  now = now.toLocalMysqlFormat();
  userRepo.createOrUpdate({
    id: conf.msftHealth.gentryId,
    mshealth_last_update: now
  });
};

msHealthRepo.getAll = function (startTime, endTime) {
  var dfd = Q.defer();
  var params = baseRepo.ensureStartAndEndTime(startTime, endTime, true);

  // Want to get 'yesterday's' sleep and display it today

  var sleepStartTime = baseRepo.getDateNDaysFromNow(-1, false);
  var sleepParams = baseRepo.ensureStartAndEndTime(sleepStartTime, params.startTime);
  var query = "SELECT *" +
    " FROM (" +
    "   (" +
    "     SELECT TRUE AS isWorkout, FALSE AS isRun, FALSE as isSleep, FALSE as isSummary, id, start_time" +
    "     FROM user_workout" +
    "     WHERE day_id >= ? AND day_id <= ?" +
    "   )" +
    "   UNION ALL" +
    "   (" +
    "     SELECT FALSE isWorkout, TRUE AS isRun, FALSE as isSleep, FALSE as isSummary, id, start_time" +
    "     FROM user_run" +
    "     WHERE day_id >= ? AND day_id <= ?" +
    "   )" +
    "   UNION ALL" +
    "   (" +
    "     SELECT FALSE isWorkout, FALSE AS isRun, TRUE as isSleep, FALSE as isSummary, id, start_time" +
    "     FROM user_sleep" +
    "     WHERE end_time >= ? AND end_time <= ?" +
    "   )" +
    "   UNION ALL" +
    "   (" +
    "     SELECT FALSE isWorkout, FALSE AS isRun, FALSE as isSleep, TRUE as isSummary, id, day_id as start_time" +
    "     FROM user_daily_summary" +
    "     WHERE day_id >= ? AND day_id <= ?" +
    "   )" +
    " ) results" +
    " ORDER BY results.start_time";
  query = db.raw(query, [
    params.startTime, params.endTime,
    params.startTime, params.endTime,
    params.startTime, params.endTime,
    params.startTime, params.endTime]);
  query.then(function (results) {
      var workoutIds = [],
        runIds = [],
        sleepIds = [],
        summaryIds = [];
      for (var i = 0; i < results[0].length; i++) {
        var result = results[0][i];
        if (result.isWorkout) {
          workoutIds.push(result.id);
        } else if (result.isRun) {
          runIds.push(result.id);
        } else if (result.isSleep) {
          sleepIds.push(result.id);
        } else if (result.isSummary) {
          summaryIds.push(result.id);
        }
      }

      var promises = [];
      promises.push(userWorkoutRepo.getByIds(workoutIds, false, 'start_time'));
      promises.push(userRunRepo.getByIds(runIds, false, 'start_time'));
      promises.push(userSleepRepo.getByIds(sleepIds, false, 'start_time'));
      promises.push(userDailySummaryRepo.getByIds(summaryIds, false, 'day_id'));
      promises.push(userRepo.getById(conf.msftHealth.gentryId, true));

      Q.all(promises)
        .then(function (promiseResults) {
          if (!promiseResults[3] || promiseResults[3].length < 1) {
            dfd.resolve([]);
            return;
          }

          var response = [];
          for (var j = 0; j < promiseResults[3].length; j++) {
            var summary = promiseResults[3][j];
            summary.lastSync = promiseResults[4].msHealthLastSync;

            var matches = [];
            // Get all Workouts, Runs and Sleeps
            if (promiseResults[0]) {
              for (var k = 0; k < promiseResults[0].length; k++) {
                if (baseRepo.onSameDay(promiseResults[0][k].dayId, summary.dayId)) {
                  promiseResults[0][k].isWorkout = true;
                  matches.push(promiseResults[0][k]);
                }
              }
            }

            if (promiseResults[1]) {
              for (var l = 0; l < promiseResults[1].length; l++) {
                if (baseRepo.onSameDay(promiseResults[1][l].dayId, summary.dayId)) {
                  promiseResults[1][l].isRun = true;
                  matches.push(promiseResults[1][l]);
                }
              }
            }

            if (promiseResults[2]) {
              for (var m = 0; m < promiseResults[2].length; m++) {
                if (baseRepo.onSameDay(promiseResults[2][m].endTime, summary.dayId)) {
                  promiseResults[2][m].isSleep = true;
                  matches.push(promiseResults[2][m]);
                }
              }
            }

            // Order results by startTime
            summary.items = _.sortBy(matches, 'startTime');

            // Add hours chart format
            summary.chartHours = dailySummaryHourModel.toHoursChartJson(summary.hours);
            response.push(summary);
          }

          dfd.resolve(response);
        });
    })
    .catch(function (err) {
      dfd.reject(err);
    });

  return dfd.promise;
};

msHealthRepo.getInsights = function() {
  var dfd = Q.defer(),
    promises = [];

  promises.push(userSleepRepo.getAffectsOfSleepInsights());
  promises.push(userSleepRepo.getAffectsOnSleepInsights());
  promises.push(userDailySummaryRepo.getActivityLevelByMonths());

  Q.all(promises)
    .then(function (results) {
      var response = {
        affectsOfSleep: results[0],
        affectsOnSleep: results[1],
        activityLevelByMonth: results[2]
      };
      dfd.resolve(response);
    });

  return dfd.promise;
};

module.exports = msHealthRepo;
