const slack = require('slack');
const slackUtils = require('../slackUtils');
const userRepo = require('../repos/user.repo');
const matchRepo = require('../repos/match.repo');

exports.getHelp = (bot) => ({
  command: `${slackUtils.mentionBot(bot)} history [@USER]`,
  help: `See your season & all-time record vs. another player.`,
});

exports.command = (bot, message, me) => {
  const args = slackUtils.getArgs(message);
  if (args.length < 2) {
    const response = [
      'Invalid command bruh!',
      `<@${bot.identity.name}> history @user`,
    ];
    bot.reply(message, response.join('\n'));
    return;
  }

  const againstId = slackUtils.getMentionId(args[1]);
  if (me.userId === againstId) {
    bot.reply(message, 'Ok skitzo...');
    return;
  }

  userRepo.getAllById(againstId)
    .then((against) => {
      if (!against.hasAccount) {
        bot.reply(message, 'I couldn\'t find that user. You should probably be working anyway...');
        return;
      }

      matchRepo.getMatchHistory(me.seasonId, me.userId, againstId)
        .then((matchHistories) => {
          const response = [
            `This season against ${against.username}:`,
            `>${matchHistories.seasonWins}W - ${matchHistories.seasonLosses}L (${matchHistories.seasonDifference}, ${matchHistories.seasonAverage}), point differential: ${matchHistories.seasonPointDiff}, ${matchHistories.seasonPointAverage}`,
            `All time:`,
            `>${matchHistories.allTimeWins}W - ${matchHistories.allTimeLosses}L (${matchHistories.allTimeDifference}, ${matchHistories.allTimeAverage}), point differential: ${matchHistories.allTimePointDiff}, ${matchHistories.allTimePointAverage}`,
          ];
          bot.reply(message, response.join('\n'));
        });
    });
};
