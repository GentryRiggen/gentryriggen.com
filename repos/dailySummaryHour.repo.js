var model = require('../models/dailySummaryHour.model'),
  tableName = 'daily_summary_hour',
  baseRepo = require('./base.repo')(tableName, model),
  userDailySummaryRepo = require('./userDailySummary.repo');

var repo = {};
repo.getById = baseRepo.getById;
repo.getByIds = baseRepo.getByIds;
repo.getByDayId = function (dayId) {
  return baseRepo.getById(dayId, 'day_id');
};
repo.createOrUpdate = baseRepo.createOrUpdate;
repo.createIfDoesNotYetExist = function (obj) {
  var dbReady = model.fromJson(obj);
  // If exists Update
  repo.getById(dbReady.start_time, 'start_time')
    .then(function (found) {
      if (found) {
        dbReady.id = found.id;
        repo.createOrUpdate(dbReady, false);
      }
    })
    .catch(function () {
      // Find matching userDailySummary or die
      userDailySummaryRepo.getByDayId(dbReady.day_id)
        .then(function(userDailySummary) {
          if (userDailySummary) {
            dbReady.user_daily_summary_id = userDailySummary.id;
            repo.createOrUpdate(dbReady, false);
          }
        });
    });
};
repo.del = baseRepo.del;

module.exports = repo;
