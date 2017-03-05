/* jshint -W117 */
const R = require('ramda');
const Q = require('q');
const slack = require('slack');
const controller = require('express').Router();
const config = require('../../config/conf');

controller.route('/redirect')
  .get((req, res) => {
    const code = R.pathOr(false, ['query', 'code'], req);
    slack.oauth.access({
      client_id: config.slack.client_id,
      client_secret: config.slack.client_secret,
      code: code,
      redirect_uri: 'http://gentryriggen.com/api/slack/redirect'
    }, (err, data) => {
      console.log(err, data);
      res.json({
        err,
        data,
        code: code,
      });
    });
  });

module.exports = controller;
