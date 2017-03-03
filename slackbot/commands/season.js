const slack = require('slack');
const slackUtils = require('../slackUtils');
const seasonRepo = require('../repos/season.repo');

exports.getHelp = (bot) => ({
  command: `${slackUtils.mentionBot(bot)} season [SEASON_NAME]`,
  help: `Create a new season and close the previous.`,
});

exports.command = (bot, message, user) => {
  const args = slackUtils.getArgs(message);

  if (!user.isCaptain) {
    bot.reply(message, 'Only team captains can start seasons. Good luck with peasantry.');
    return;
  }

  const seasonName = args[1];
  seasonRepo.createNewSeason(seasonName, user.teamId)
    .then((newSeason) => {
      bot.reply(message, [
        'New season created!',
        `>*${newSeason.name}*`,
      ].join('\n'));
    });
};

