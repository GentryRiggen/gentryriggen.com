const R = require('ramda');
const slackUtils = require('../../slackUtils');
const slack = require('slack');
const config = require('../../../config/conf');
const seasonRepo = require('../../repos/season.repo');

module.exports = function (param, user) {
  const channel = R.propOr('', 'channel', param);
  const args = R.propOr([], 'args', param);

  if (!user.isCaptain) {
    slackUtils.postMessage(channel, 'Only team captains can start seasons. Good luck with peasantry.');
    return;
  } else if (args.length < 2) {
    slackUtils.postMessage(channel, [
      'Invalid Season command',
      'pong season [SEASON_NAME]',
    ].join('\n'));
    return;
  }

  const seasonName = args[1];
  seasonRepo.createNewSeason(seasonName, user.teamId)
    .then((newSeason) => {
      slackUtils.postMessage(channel, [
        'New season created!',
        `>*${newSeason.name}*`,
        'Glad to see no work is getting done...'
      ].join('\n'));
    });
};

