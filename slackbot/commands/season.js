const R = require('ramda');
const slack = require('slack');
const slackUtils = require('../slackUtils');
const seasonRepo = require('../repos/season.repo');

module.exports = (bot, message, user) => {
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

