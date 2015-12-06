/* jshint -W117 */
var express = require('express'),
  ctrl = express.Router(),
  conf = require('../config/conf'),
  msHealthRepo = require('../repos/msHealth.repo'),
  baseRepo = require('../repos/base.repo')();

ctrl.route('/day/:date')
  .get(function (req, res) {
    var params = baseRepo.ensureStartAndEndTime(req.params.date, req.params.date);
    msHealthRepo.getAll(params.startTime, params.endTime)
      .then(function (results) {
        res.json(results);
      });
  });

ctrl.route('/sync')
  .get(function (req, res) {
    if (req.query.secret != conf.msftHealth.syncSecret) {
      res.status(400).send({message: 'Go away'});
    }

    var params = baseRepo.ensureStartAndEndTime(req.query.startTime, req.query.endTime);
    msHealthRepo.sync(params.startTime, params.endTime);
    res.status(200).send({message: 'Updates in progress'});
  });

ctrl.route('/syncAll')
  .get(function (req, res) {
    if (req.query.secret != conf.msftHealth.syncSecret) {
      res.status(400).send({message: 'Go away'});
    }

    var startDaysBack = req.query.startDaysBack ? req.query.startDaysBack : 0;
    var startDate = baseRepo.getDateNDaysFromNow(0 - startDaysBack, true);
    var daysBack = req.query.daysBack ? req.query.daysBack : 365 * 2,
      daysProcessed = [];
    var timer = setInterval(function () {
      if (daysBack > 0) {
        var date = baseRepo.getDateNDaysFromDate(startDate, 0 - daysBack, true);
        var params = baseRepo.ensureStartAndEndTime(date, date);
        msHealthRepo.sync(params.startTime, params.endTime);
        daysProcessed.push(date);
      } else {
        clearInterval(timer);
        res.json(daysProcessed);
      }

      daysBack--;
    }, 100);
  });

module.exports = ctrl;
