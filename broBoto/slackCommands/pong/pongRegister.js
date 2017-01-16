const R = require('ramda');
const slackUtils = require('../../slackUtils');
const slack = require('slack');
const config = require('../../../config/conf');
const teamRepo = require('../../repos/team.repo');

module.exports = function (param) {
  const channel = R.propOr('', 'channel', param);
  const args = R.propOr([], 'args', param);

  const captainId = param.user;
  slackUtils.getUser(captainId)
    .then((user) => {
      teamRepo.getById(user.team_id)
        .then((team) => {
          if (!team) {
            slackUtils.postMessage(channel, 'Team has not been initialized yet. Ask your Slack Admin to run pong init.');
            return;
          } else {
            slackUtils.createOrGetUser(user.id, team.id)
              .then((newUser) => {
                const response = `Welcome to *${team.name}*`;
                slackUtils.postMessage(channel, response);
              });
          }
        });
    })
    .catch(error => slackUtils.postMessage(channel, 'Failed to register user...'));
};

