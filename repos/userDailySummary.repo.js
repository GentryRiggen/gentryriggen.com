var model = require('../models/userDailySummary.model'),
  tableName = 'user_daily_summary',
  baseRepo = require('./base.repo')(tableName, model);

var repo = {};
repo.getById = baseRepo.getById;
repo.getByDayId = function (dayId) {
  return baseRepo.getById(dayId, 'day_id');
};
repo.createOrUpdate = baseRepo.createOrUpdate;
repo.createIfDoesNotYetExist = function (obj) {
  var dbReady = model.fromJson(obj);
  repo.getByDayId(dbReady.day_id)
    .then(function(found) {
      dbReady.id = found.id;
      repo.createOrUpdate(dbReady, false);
    })
    .catch(function () {
      repo.createOrUpdate(dbReady, false);
    });
};
repo.del = baseRepo.del;

module.exports = repo;
