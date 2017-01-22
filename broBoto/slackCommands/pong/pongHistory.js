const R = require('ramda');
const slackUtils = require('../../slackUtils');
const slack = require('slack');
const userRepo = require('../../repos/user.repo');
const matchRepo = require('../../repos/match.repo');

module.exports = function (param, me) {
  const channel = R.propOr('', 'channel', param);
  const args = R.propOr([], 'args', param);

  if (args.length < 2) {
    invalidMessage(channel);
    return;
  }

  const againstId = slackUtils.getMentionId(args[1]);
  if (me.userId === againstId) {
    slackUtils.postMessage(channel, 'Ok skitzo...');
    return;
  }

  userRepo.getAllById(againstId)
    .then((against) => {
      if (!against) {
        slackUtils.postMessage(channel, 'I couldn\'t find the users... You should probably be working anyway.');
        return;
      }

      matchRepo.getMatchHistory(me.seasonId, me.userId, againstId)
        .then((matchHistories) => {
          const response = [
            `This season against ${against.username}:`,
            `>${matchHistories.seasonWins}W - ${matchHistories.seasonLosses}L (${matchHistories.seasonDifference}, ${matchHistories.seasonAverage}), point differential: ${matchHistories.seasonPointDiff}`,
            `All time:`,
            `>${matchHistories.allTimeWins}W - ${matchHistories.allTimeLosses}L (${matchHistories.allTimeDifference}, ${matchHistories.allTimeAverage}), point differential: ${matchHistories.allTimePointDiff}`,
          ];
          slackUtils.postMessage(channel, response.join('\n'));
        });
    });
};

const invalidMessage = (channel) => {
  const response = [
    'Invalid command bruh!',
    'pong history @yourmom',
  ];
  slackUtils.postMessage(channel, response.join('\n'));
};
