const R = require('ramda');
const slack = require('slack');
const slackUtils = require('../slackUtils');
const seasonRepo = require('../repos/season.repo');

exports.getHelp = (bot) => ({
  command: `${slackUtils.mentionBot(bot)} leaderboard [TYPE(elo|points|pd)]`,
  help: `Get the leaderboard for the active season. You can sort by elo or point differential.`,
});

exports.command = (bot, message, loser) => {
  const args = slackUtils.getArgs(message);
  let validType = 'elo';
  if (args.length > 1) {
    const leaderBoardType = args[1];
    const leaderBoards = {
      elo: 'elo',
      points: 'points',
      pd: 'points',
    };

    validType = R.propOr(false, leaderBoardType, leaderBoards);
    if (!validType) {
      const leaderBoardTypes = Object.keys(leaderBoards).map(key => `<@${bot.identity.name}> leaderboard ${key}`);
      bot.reply(
        message,
        'I have never heard of that leaderboard. Try\n>>>' + leaderBoardTypes.join('\n'));
      return;
    }
  }

  seasonRepo.getLeaderboard(loser.seasonId, validType)
    .then((leaderboard) => {
      slackUtils.postLeaderboard(bot, message, leaderboard, validType);
    });
};
