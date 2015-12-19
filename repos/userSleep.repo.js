var model = require('../models/userSleep.model'),
  tableName = 'user_sleep',
  baseRepo = require('./base.repo')(tableName, model),
  minuteRepo = require('./sleepMinute.repo'),
  segmentRepo = require('./sleepSegment.repo'),
  minuteModel = require('../models/sleepMinute.model'),
  db = require('../db'),
  Q = require('q');

var repo = {};
repo.getById = baseRepo.getById;

//repo.getByIds = baseRepo.getByIds;

repo.getByIds = function (ids) {
  var dfd = Q.defer(),
    modeledResults = [];
  if (!ids || ids.length < 1) {
    dfd.resolve(modeledResults);
    return;
  }

  var query = 'SELECT' +
    '\nus.*,' +
    '\nsm.id as `minutes:id`,' +
    '\nsm.user_sleep_id as `minutes:user_sleep_id`,' +
    '\nsm.start_time as `minutes:start_time`,' +
    '\nsm.end_time as `minutes:end_time`,' +
    '\nsm.calories_burned as `minutes:calories_burned`,' +
    '\nsm.average_heart_rate as `minutes:average_heart_rate`,' +
    '\nsm.peak_heart_rate as `minutes:peak_heart_rate`,' +
    '\nsm.lowest_heart_rate as `minutes:lowest_heart_rate`' +
    '\nFROM user_sleep us' +
    '\nLEFT JOIN sleep_minute sm ON (sm.user_sleep_id = us.id)' +
    '\nWHERE us.id IN (?)' +
    '\nORDER BY us.day_id DESC, us.start_time, sm.start_time;';

  query = db.raw(query, [ids]);
  query.then(function(results) {
    var items = baseRepo.objectifySQLResult(results[0], 'minutes');

    items.forEach(function (item) {
      var jsonModel = model.toJson(item);

      jsonModel.minutes = [];
      if (item.minutes) {
        item.minutes.forEach(function (minute) {
          var jsonMinute = minuteModel.toJson(minute);
          jsonModel.minutes.push(jsonMinute);
        });
      }

      // Get Minutes Chart Data
      jsonModel.chartMinutes = minuteModel.toMinutesChartJson(jsonModel.minutes);

      modeledResults.push(jsonModel);
    });

    dfd.resolve(modeledResults);
  });

  return dfd.promise;
};

repo.getByMsHealthId = function (msHealthId) {
  return baseRepo.getById(msHealthId, 'mshealth_id');
};
repo.createOrUpdate = baseRepo.createOrUpdate;
repo.createIfDoesNotYetExist = function (obj) {
  var dbReady = model.fromJson(obj);
  repo.getByMsHealthId(dbReady.mshealth_id)
    .then(function() {})
    .catch(function () {
      repo.createOrUpdate(dbReady, false)
        .then(function (inserted) {
          if (obj.minuteSummaries) {
            obj.minuteSummaries.forEach(function (minute) {
              minuteRepo.createOrUpdateWithParent(minute, inserted.id)
            });
          }

          if (obj.activitySegments) {
            obj.activitySegments.forEach(function (segment){
              segmentRepo.createOrUpdateWithParent(segment, inserted.id)
            });
          }
        });
    });
};
repo.del = baseRepo.del;

repo.getAffectsOfSleepInsights = function () {
  var query = "SELECT lessThan5.avgSteps AS less5Steps, lessThan5.avgCals AS less5Cals, " +
    "greaterThan5.avgSteps AS greater5Steps, greaterThan5.avgCals AS greater5Cals, " +
    "greaterThan6.avgSteps AS greater6Steps, greaterThan6.avgCals AS greater6Cals, " +
    "greaterThan7.avgSteps AS greater7Steps, greaterThan7.avgCals AS greater7Cals, " +
    "greaterThan8.avgSteps AS greater8Steps, greaterThan8.avgCals AS greater8Cals, " +
    "greaterThan9.avgSteps AS greater9Steps, greaterThan9.avgCals AS greater9Cals " +
  "FROM " +
  "( " +
  "SELECT ROUND(AVG(uds.steps_taken)) AS avgSteps,ROUND(AVG(uds.calories_burned)) AS avgCals " +
  "FROM user_daily_summary uds " +
  "WHERE uds.day_id IN ( " +
  "  SELECT CONCAT(YEAR(us.end_time),'-',MONTH(us.end_time),'-',DAY(us.end_time)) as day_id " +
  "  FROM user_sleep us " +
  "  WHERE us.sleep_duration > (60*60*9)) " +
  ") greaterThan9, " +
  "( " +
  "SELECT ROUND(AVG(uds.steps_taken)) AS avgSteps,ROUND(AVG(uds.calories_burned)) AS avgCals " +
  "FROM user_daily_summary uds " +
  "WHERE uds.day_id IN ( " +
  "  SELECT CONCAT(YEAR(us.end_time),'-',MONTH(us.end_time),'-',DAY(us.end_time)) as day_id " +
  "  FROM user_sleep us " +
  "  WHERE us.sleep_duration > (60*60*8) AND us.sleep_duration < (60*60*9)) " +
  ") greaterThan8, " +
  "( " +
  "SELECT ROUND(AVG(uds.steps_taken)) AS avgSteps,ROUND(AVG(uds.calories_burned)) AS avgCals " +
  "FROM user_daily_summary uds " +
  "WHERE uds.day_id IN ( " +
  "  SELECT CONCAT(YEAR(us.end_time),'-',MONTH(us.end_time),'-',DAY(us.end_time)) as day_id " +
  "  FROM user_sleep us " +
  "  WHERE us.sleep_duration > (60*60*7) AND us.sleep_duration < (60*60*8)) " +
  ") greaterThan7, " +
  "( " +
  "SELECT ROUND(AVG(uds.steps_taken)) AS avgSteps,ROUND(AVG(uds.calories_burned)) AS avgCals " +
  "FROM user_daily_summary uds " +
  "WHERE uds.day_id IN ( " +
  "  SELECT CONCAT(YEAR(us.end_time),'-',MONTH(us.end_time),'-',DAY(us.end_time)) as day_id " +
  "  FROM user_sleep us " +
  "  WHERE us.sleep_duration > (60*60*6) AND us.sleep_duration < (60*60*7)) " +
  ") greaterThan6, " +
  "( " +
  "SELECT ROUND(AVG(uds.steps_taken)) AS avgSteps,ROUND(AVG(uds.calories_burned)) AS avgCals " +
  "FROM user_daily_summary uds " +
  "WHERE uds.day_id IN ( " +
  "  SELECT CONCAT(YEAR(us.end_time),'-',MONTH(us.end_time),'-',DAY(us.end_time)) as day_id " +
  "  FROM user_sleep us " +
  "  WHERE us.sleep_duration > (60*60*5) AND us.sleep_duration < (60*60*6)) " +
  ") greaterThan5, " +
  "( " +
  "SELECT ROUND(AVG(uds.steps_taken)) AS avgSteps,ROUND(AVG(uds.calories_burned)) AS avgCals " +
  "FROM user_daily_summary uds " +
  "WHERE uds.day_id IN ( " +
  "  SELECT CONCAT(YEAR(us.end_time),'-',MONTH(us.end_time),'-',DAY(us.end_time)) as day_id " +
  "  FROM user_sleep us " +
  "  WHERE us.sleep_duration < (60*60*5)) " +
  ") lessThan5;";

  query = db.raw(query);
  return query.then(function(results) {
    return model.getAffectsOfSleepChartData(results[0][0]);
  });
};

repo.getAffectsOnSleepInsights = function() {
  var query = "SELECT " +
    "ROUND(rDays.avg/60/60,2) as rDays, " +
    "ROUND(wDays.avg/60/60,2) as wDays, " +
    "ROUND(rwDays.avg/60/60,2) as rwDays, " +
    "ROUND(nillDays.avg/60/60,2) as nillDays " +
  "FROM " +
  "(SELECT ROUND(AVG(sleep_duration)) as avg " +
  "FROM user_sleep " +
  "WHERE " +
  "day_id IN (SELECT day_id FROM user_run) " +
  ") rDays, " +
  "(SELECT ROUND(AVG(sleep_duration)) as avg " +
  "FROM user_sleep " +
  "WHERE " +
  "day_id IN (SELECT day_id FROM user_workout) " +
  ") wDays, " +
  "(SELECT ROUND(AVG(sleep_duration)) as avg " +
  "FROM user_sleep " +
  "WHERE " +
  "day_id IN (SELECT user_workout.day_id FROM user_workout INNER JOIN user_run ON user_run.day_id = user_workout.day_id) " +
  ") rwDays, " +
  "(SELECT ROUND(AVG(sleep_duration)) as avg " +
  "FROM user_sleep " +
  "WHERE " +
  "day_id NOT IN (SELECT day_id FROM user_run) " +
  "OR day_id NOT IN (SELECT day_id FROM user_workout) " +
  ") nillDays;";

  return db.raw(query)
    .then(function (results) {
      return model.getAffectsOnSleepChartData(results[0][0]);
    });
};

module.exports = repo;
