var model = require('../models/userRun.model'),
  tableName = 'user_run',
  baseRepo = require('./base.repo')(tableName, model),
  minuteRepo = require('./runMinute.repo'),
  minuteModel = require('../models/runMinute.model'),
  db = require('../db'),
  Q = require('q');

var repo = {};
repo.getById = baseRepo.getById;

repo.getByIds = function (ids) {
  var dfd = Q.defer(),
    modeledResults = [];
  if (!ids || ids.length < 1) {
    dfd.resolve(modeledResults);
    return;
  }

  var query = 'SELECT' +
    '\nur.*,' +
    '\nrm.id as `minutes:id`,' +
    '\nrm.user_run_id as `minutes:user_run_id`,' +
    '\nrm.start_time as `minutes:start_time`,' +
    '\nrm.end_time as `minutes:end_time`,' +
    '\nrm.steps_taken as `minutes:steps_taken`,' +
    '\nrm.calories_burned as `minutes:calories_burned`,' +
    '\nrm.average_heart_rate as `minutes:average_heart_rate`,' +
    '\nrm.peak_heart_rate as `minutes:peak_heart_rate`,' +
    '\nrm.lowest_heart_rate as `minutes:lowest_heart_rate`' +
    '\nFROM user_run ur' +
    '\nLEFT JOIN run_minute rm ON (rm.user_run_id = ur.id)' +
    '\nWHERE ur.id IN (?)' +
    '\nORDER BY ur.day_id DESC, ur.start_time, rm.start_time;';

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
            obj.minuteSummaries.forEach(function (minute){
              minuteRepo.createOrUpdateWithParent(minute, inserted.id);
            });
          }
        });
    });
};
repo.del = baseRepo.del;

module.exports = repo;
