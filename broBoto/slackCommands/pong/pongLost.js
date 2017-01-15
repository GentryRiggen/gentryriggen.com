const R = require('ramda');
const Q = require('q');
const slackUtils = require('../../slackUtils');
const slack = require('slack');
const userRepo = require('../../repos/user.repo');
const matchRepo = require('../../repos/match.repo');
const rankingsRepo = require('../../repos/ranking.repo');
const seasonRepo = require('../../repos/season.repo');

const getRatingDelta = (myRating, opponentRating, myGameResult) => {
  if ([0, 0.5, 1].indexOf(myGameResult) === -1) {
    return null;
  }

  const myChanceToWin = 1 / ( 1 + Math.pow(10, (opponentRating - myRating) / 400));

  return Math.round(32 * (myGameResult - myChanceToWin));
};

const getNewRating = (myRating, opponentRating, myGameResult) => {
  return myRating + getRatingDelta(myRating, opponentRating, myGameResult);
};

module.exports = function (param, loser) {
  const channel = R.propOr('', 'channel', param);
  const args = R.propOr([], 'args', param);

  if (args.length < 2) {
    invalidMessage(channel);
    return;
  }

  const winnerId = args[1].replace('<@', '').replace('>', '');
  if (loser.userId == winnerId) {
    slackUtils.postMessage(channel, `You would find a way to lose to yourself, ${loser.username}...`);
    return;
  }

  userRepo.getAllById(winnerId)
    .then((winner) => {
      if (!winner) {
        slackUtils.postMessage(channel, 'I couldn\'t find the users... You should probably be working anyway.');
        return;
      }

      const loserNewELO = getNewRating(loser.elo, winner.elo, 0);
      const winnerNewELO = getNewRating(winner.elo, loser.elo, 1);

      const match = {
        seasonId: loser.seasonId,
        loserId: loser.userId,
        loserOldELO: loser.elo,
        loserNewELO,
        winnerId: winner.userId,
        winnerOldELO: winner.elo,
        winnerNewELO,
        dateCreated: (new Date()).toMysqlFormat(),
      };

      matchRepo.createOrUpdate(match)
        .then(() => {
          let rankings = [];
          rankings.push(rankingsRepo.updateUserRanking(loser.seasonId, loser.userId));
          rankings.push(rankingsRepo.updateUserRanking(loser.seasonId, winner.userId));
          Q.all(rankings)
            .then(() => {
              seasonRepo.getLeaderboard(loser.seasonId)
                .then((leaderboard) => {
                  slackUtils.postLeaderboard(channel, leaderboard);
                });
            });
        });
    });
};

const invalidMessage = (channel) => {
  const response = [
    'Invalid command bruh!',
    'pong lost to @yourmom',
  ];
  slackUtils.postMessage(channel, response.join('\n'));
};
