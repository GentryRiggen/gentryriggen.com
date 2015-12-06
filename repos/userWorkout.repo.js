var model = require('../models/userWorkout.model'),
  tableName = 'user_workout',
  baseRepo = require('./base.repo')(tableName, model),
  minuteRepo = require('./workoutMinute.repo'),
  minuteModel = require('../models/workoutMinute.model'),
  db = require('../db'),
  Q = require('q'),
  Treeize = require('treeize');

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
//    '\nuw.*,' +
//    '\nwm.id as `minutes:id`,' +
//    '\nwm.user_workout_id as `minutes:user_workout_id`,' +
//    '\nwm.start_time as `minutes:start_time`,' +
//    '\nwm.end_time as `minutes:end_time`,' +
//    '\nwm.steps_taken as `minutes:steps_taken`,' +
//    '\nwm.calories_burned as `minutes:calories_burned`,' +
//    '\nwm.average_heart_rate as `minutes:average_heart_rate`,' +
//    '\nwm.peak_heart_rate as `minutes:peak_heart_rate`,' +
//    '\nwm.lowest_heart_rate as `minutes:lowest_heart_rate`' +
//    '\nFROM user_workout uw' +
//    '\nLEFT JOIN workout_minute wm ON (wm.user_workout_id = uw.id)' +
//    '\nWHERE uw.id IN (?)' +
//    '\nORDER BY uw.day_id DESC, uw.start_time;';
//
//  query = db.raw(query, [ids]);
//  query.then(function(results) {
//    var items = new Treeize()
//      .grow(results[0], { log: true, input: { delimiter: ':', detectCollections: true }})
//      .getData();
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
            obj.minuteSummaries.forEach(function (minute){
              minuteRepo.createOrUpdateWithParent(minute, inserted.id)
            });
          }
        });
    });
};
repo.del = baseRepo.del;

module.exports = repo;
