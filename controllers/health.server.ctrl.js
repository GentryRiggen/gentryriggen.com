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

module.exports = ctrl;
