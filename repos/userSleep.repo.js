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
repo.getByIds = baseRepo.getByIds;
//repo.getByIds = function (ids) {
//  var dfd = Q.defer(),
//    modeledResults = [];
//  if (!ids || ids.length < 1) {
//    dfd.resolve(modeledResults);
//    return;
//  }
//
//  var query = 'SELECT' +
//    '\nus.*,' +
//    '\nwm.id as `minutes:id`,' +
//    '\nwm.user_sleep_id as `minutes:user_sleep_id`,' +
//    '\nwm.start_time as `minutes:start_time`,' +
//    '\nwm.end_time as `minutes:end_time`,' +
//    '\nwm.steps_taken as `minutes:steps_taken`,' +
//    '\nwm.calories_burned as `minutes:calories_burned`,' +
//    '\nwm.average_heart_rate as `minutes:average_heart_rate`,' +
//    '\nwm.peak_heart_rate as `minutes:peak_heart_rate`,' +
//    '\nwm.lowest_heart_rate as `minutes:lowest_heart_rate`' +
//    '\nFROM user_sleep us' +
//    '\nLEFT JOIN sleep_minute wm ON (wm.user_sleep_id = us.id)' +
//    '\nWHERE us.id IN (?)' +
//    '\nORDER BY us.day_id DESC, us.start_time;';
//
//  query = db.raw(query, [ids]);
//  query.then(function(results) {
//    var items = baseRepo.objectifySQLResult(results[0], 'minutes');
//
//    items.forEach(function (item) {
//      var jsonModel = model.toJson(item);
//
//      jsonModel.minutes = [];
//      if (item.minutes) {
//        item.minutes.forEach(function (minute) {
//          var jsonMinute = minuteModel.toJson(minute);
//          jsonModel.minutes.push(jsonMinute);
//        });
//      }
//
//      // Get Minutes Chart Data
//      jsonModel.chartMinutes = minuteModel.toMinutesChartJson(jsonModel.minutes);
//
//      modeledResults.push(jsonModel);
//    });
//
//    dfd.resolve(modeledResults);
//  });
//
//  return dfd.promise;
//};

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

module.exports = repo;
