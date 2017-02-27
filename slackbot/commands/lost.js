const R = require('ramda');
const Q = require('q');
const slack = require('slack');
const slackUtils = require('../slackUtils');
const userRepo = require('../repos/user.repo');
const matchRepo = require('../repos/match.repo');
const rankingsRepo = require('../repos/ranking.repo');
const seasonRepo = require('../repos/season.repo');

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

module.exports = (bot, message, loser) => {
  const args = slackUtils.getArgs(message);
  let skunk = false;
  if (args.length > 1) {
    skunk = args[1] === 'skunked';
  }

  if (!skunk && args.length < 4) {
    invalidMessage(bot, message);
    return;
  }

  const specifiedWinner = skunk ? args[0] : args[1];
  const winnerId = slackUtils.getMentionId(specifiedWinner);
  if (loser.userId == winnerId) {
    bot.reply(message, `You would find a way to lose to yourself, ${loser.username}...`);
    return;
  }

  userRepo.getAllById(winnerId)
    .then((winner) => {
      if (!winner) {
        bot.reply(message, 'I couldn\'t find that user... You should probably be working anyway.');
        return;
      }

      const loserNewELO = getNewRating(loser.elo, winner.elo, 0);
      const winnerNewELO = getNewRating(winner.elo, loser.elo, 1);

      let loserPoints;
      if (skunk) {
        loserPoints = 0;
      } else {
        const lostBy = parseInt(args[3]);
        if (lostBy < 2) {
          bot.reply(message, 'You cannot lose by less than 2...');
          return;
        } else if (lostBy > 19) {
          bot.reply(message, 'You either got skunked or don\'t know how to play this game...');
          return;
        }
        loserPoints = 21 - lostBy;
      }

      const match = {
        seasonId: loser.seasonId,
        loserId: loser.userId,
        loserOldELO: loser.elo,
        loserNewELO,
        winnerId: winner.userId,
        winnerOldELO: winner.elo,
        winnerNewELO,
        winnerPoints: 21,
        loserPoints,
        skunk: skunk ? 1 : 0,
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
                  if (skunk) {
                    bot.reply(message, 'SKUNKED!!! This match has been recorded as 0-21. Ouch...');
                  }
                  slackUtils.postLeaderboard(bot, message, leaderboard);
                });
            });
        });
    });
};

const invalidMessage = (bot, message) => {
  bot.api.reactions.add({
    timestamp: message.ts,
    channel: message.channel,
    name: 'unamused',
  });
  const response = [
    'Invalid command',
    `><@${bot.identity.name}> lost @user by 19`,
    'OR',
    `><@${bot.identity.name}> @user skunked me`,
  ];
  bot.reply(message, response.join('\n'));
};
