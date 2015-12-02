/* jshint -W117 */
var express = require('express'),
  ctrl = express.Router(),
  conf = require('../config/conf'),
  msHealthRepo = require('../repos/msHealth.repo'),
  baseRepo = require('../repos/base.repo')();

ctrl.route('/day/:date')
  .get(function (req, res) {
    var query = baseRepo.getStartAndEndQuery({
      startTime: req.params.date,
      endTime: req.params.date
    });
    msHealthRepo.getAll(query.startTime, query.endTime)
      .then(function (results) {
        res.json(results);
      });
  });

ctrl.route('/sync')
  .get(function (req, res) {
    if (req.query.secret != conf.msftHealth.syncSecret) {
      res.status(400).send({message: 'Go away'});
    }

    var query = baseRepo.getStartAndEndQuery(req.query);

    msHealthRepo.sync(query.startTime, query.endTime);
    res.status(200).send({message: 'Updates in progress'});
  });

module.exports = ctrl;
