var db = require('../db'),
  moment = require('moment'),
  conf = require('../config/conf');
require('moment-timezone');

var repo = function (tableName, model) {
  var baseRepo = {};

  baseRepo.getPaginatedParams = function (params) {
    var page = 'page' in params ? parseInt(params.page) : 1,
      pageSize = 'pageSize' in params ? parseInt(params.pageSize) : 5,
      skip = (page - 1) * pageSize;

    return {page: page, pageSize: pageSize, skip: skip};
  };

  baseRepo.getById = function (id, idField) {
    var selectField = idField ? idField : 'id';
    return db(tableName).where(selectField, id).first()
      .then(function (item) {
        return model.toJson(item);
      });
  };

  baseRepo.getByIds = function (idsArray, idField, orderByField, orderByDirection) {
    var selectField = idField ? idField : 'id';
    var query = db(tableName)
      .whereIn(selectField, idsArray);

    if (orderByField) {
      var direction = orderByDirection && (orderByDirection == 'ASC' || orderByDirection == 'DESC') ?
        orderByDirection : 'ASC';
      query.orderBy(orderByField, direction);
    }

    return query.then(function (results) {
      var modeledResults = [];
      results.forEach(function (result) {
        modeledResults.push(model.toJson(result));
      });

      return modeledResults;
    });
  };

  baseRepo.createOrUpdate = function (data, convert) {
    if (convert && model.fromJson) {
      data = model.fromJson(data);
    }
    var update = data.id > 0;
    if (!update) {
      delete data.id;
    }
    var query = update ? db(tableName).where('id', data.id).update(data) : db.insert(data).into(tableName).returning('id');
    return query.then(function (ids) {
      return update ? null : baseRepo.getById(ids[0]);
    });
  };

  baseRepo.del = function (id) {
    return db(tableName).where('id', id).del();
  };

  baseRepo.getTodayLocal = function (toISOString) {
    var now = moment().tz(conf.msftHealth.timeZone);
    return toISOString ? now.toDate().toISOLocalString() : now;
  };

  baseRepo.getDateNDaysFromNow = function (days, toISOString) {
    var now = baseRepo.getTodayLocal(false);
    var requestedDate = days > 0 ? now.add(days, 'days') : now.subtract(Math.abs(days), 'days');

    return toISOString ? requestedDate.toDate().toISOLocalString() : requestedDate;
  };

  baseRepo.getDateNDaysFromDate = function (date, days, toISOString) {
    var startDate = moment(date).tz(conf.msftHealth.timeZone);
    var requestedDate = days > 0 ? startDate.add(days, 'days') : startDate.subtract(Math.abs(days), 'days');

    return toISOString ? requestedDate.toDate().toISOLocalString() : requestedDate;
  };

  baseRepo.ensureStartAndEndTime = function (startTime, endTime, toISOLocalString) {
    startTime = startTime ? moment(startTime).tz(conf.msftHealth.timeZone) : moment().tz(conf.msftHealth.timeZone);
    startTime.hour(0);
    startTime.minute(0);
    startTime.second(0);

    endTime = endTime ? moment(endTime).tz(conf.msftHealth.timeZone) : moment(startTime).tz(conf.msftHealth.timeZone);
    endTime.hour(23);
    endTime.minute(59);
    endTime.second(59);

    if (toISOLocalString === true) {
      return {
        startTime: startTime.toDate().toISOLocalString(),
        endTime: endTime.toDate().toISOLocalString()
      };
    } else {
      return {
        startTime: startTime.toDate(),
        endTime: endTime.toDate()
      };
    }
  };

  return baseRepo;
};

module.exports = repo;
