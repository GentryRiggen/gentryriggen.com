/* jshint -W117 */
var express = require('express'),
  ctrl = express.Router(),
  conf = require('../config/conf'),
  msHealthRepo = require('../repos/msHealth.repo');

function getStartAndEndQuery(query) {
  var startTime, endTime;
  if (query.startTime) {
    startTime = new Date(query.startTime);
    startTime.setUTCHours(0, 0, 0, 0);
  } else {
    startTime = new Date();
    startTime.setDate(startTime.getDate() - 6);
    startTime.setUTCHours(0, 0, 0, 0);
  }

  if (query.endTime) {
    endTime = new Date(query.endTime);
    endTime.setUTCHours(23, 59, 59, 99);
  } else {
    endTime = new Date();
    endTime.setUTCHours(23, 59, 59, 99);
  }

  return {
    startTime: startTime,
    endTime: endTime
  };
}

ctrl.route('/day/:date')
  .get(function (req, res) {
    var query = getStartAndEndQuery({
      startTime: req.params.date,
      endTime: req.params.date
    });
    console.log(query);
    msHealthRepo.getAll(query.startTime, query.endTime)
      .then(function (results) {
        console.log(results);
        res.json(results);
      });
  });

ctrl.route('/sync')
  .get(function (req, res) {
    if (req.query.secret != conf.msftHealth.syncSecret) {
      res.status(400).send({message: 'Go away'});
    }

    var query = getStartAndEndQuery(req.query);

    msHealthRepo.sync(query.startTime, query.endTime);
    res.status(200).send({message: 'Updates in progress'});
  });

module.exports = ctrl;
