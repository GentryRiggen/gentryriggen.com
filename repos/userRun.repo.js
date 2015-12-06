var model = require('../models/userRun.model'),
  tableName = 'user_run',
  baseRepo = require('./base.repo')(tableName, model),
  minuteRepo = require('./runMinute.repo');

var repo = {};
repo.getById = baseRepo.getById;
repo.getByIds = baseRepo.getByIds;
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
