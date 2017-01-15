const R = require('ramda');
const slackUtils = require('../../slackUtils');
const slack = require('slack');
const seasonRepo = require('../../repos/season.repo');

module.exports = function (param, loser) {
  const channel = R.propOr('', 'channel', param);
  const args = R.propOr([], 'args', param);

  seasonRepo.getLeaderboard(loser.seasonId)
    .then((leaderboard) => {
      slackUtils.postLeaderboard(channel, leaderboard);
    });
};
