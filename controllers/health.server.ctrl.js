/* jshint -W117 */
var express = require('express'),
  ctrl = express.Router(),
  conf = require('../config/conf'),
  msHealthRepo = require('../repos/msHealth.repo');

ctrl.route('/sync')
  .get(function (req, res) {
    if (req.query.secret != conf.msftHealth.syncSecret) {
      res.status(400).send({message: 'Go away'});
    }

    var startTime, endTime;
    if (req.query.startTime) {
      startTime = new Date(req.query.startTime);
      startTime.setHours(0, 0, 0, 0);
    } else {
      startTime = new Date();
      startTime.setDate(startTime.getDate() - 1);
      startTime.setHours(0, 0, 0, 0);
    }

    if (req.query.endTime) {
      endTime = new Date(req.query.endTime);
      endTime.setHours(23, 59, 59, 99);
    } else {
      endTime = new Date(startTime);
      endTime.setHours(23, 59, 59, 99);
    }

    console.log(startTime, endTime);
    msHealthRepo.sync(startTime, endTime);
    res.status(200).send({message: 'Updates in progress'});
  });

module.exports = ctrl;
