const R = require('ramda');
const slackUtils = require('../../slackUtils');
const slack = require('slack');
const userRepo = require('../../repos/user.repo');
const matchRepo = require('../../repos/match.repo');
const rankingsRepo = require('../../repos/ranking.repo');

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
            `>${matchHistories.seasonWins} Wins, ${matchHistories.seasonLosses} Losses (${matchHistories.seasonDifference}, ${matchHistories.seasonAverage})`,
            `All time:`,
            `>${matchHistories.allTimeWins} Wins, ${matchHistories.allTimeLosses} Losses (${matchHistories.allTimeDifference}, ${matchHistories.allTimeAverage})`,
          ];
          slackUtils.postMessage(channel, response.join('\n'));
        });
    });

  // TEMP
  userRepo.getAll()
    .then((allUsers) => {
      allUsers.forEach((user) => {
        rankingsRepo.updateUserRanking(me.seasonId, user.id);
      });
    })
    .catch((err) => console.log('Something went wrong!', err));
  // END TEMP
};

const invalidMessage = (channel) => {
  const response = [
    'Invalid command bruh!',
    'pong history @yourmom',
  ];
  slackUtils.postMessage(channel, response.join('\n'));
};
