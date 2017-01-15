const slackUtils = require('../slackUtils');
const R = require('ramda');
const slack = require('slack');
const config = require('../../config/conf');
const userRepo = require('../repos/user.repo');

module.exports = function (param) {
  const channel = R.propOr('', 'channel', param);
  const args = R.propOr([], 'args', param);

  if (args.length < 1) {
    invalidMessage(channel);
    return;
  }

  const pongArg = args[0].toLowerCase();
  if (pongArg === 'init') {
    require('./pong/pongInit')(param);
    return;
  } else if (pongArg === 'register') {
    require('./pong/pongRegister')(param);
    return;
  }

  // On every request get current pong details
  const failed = (error) => {
    const message = error || 'Failed to process pong request.';
    slackUtils.postMessage(channel, message);
  };
  userRepo.getAllById(param.user)
    .then((currentUser) => {
      if (!currentUser) {
        failed();
        return;
      }

      switch (pongArg) {
        case 'season':
          require('./pong/pongSeason')(param, currentUser);
          break;
        case 'lost':
          require('./pong/pongLost')(param, currentUser);
          break;
        case 'leaderboard':
          require('./pong/pongLeaderboard')(param, currentUser);
          break;
        default:
          invalidMessage(channel);
          break;
      }
    })
    .catch(failed);
};

const invalidMessage = (channel) => {
  const response = [
    'I remember the first time I used a computer...',
    'How to use broboto pong:',
    '```1. PONG INIT - Initialize team for the first time (can only be done once by a slack admin).',
    '2. PONG REGISTER - Register to play ping pong.',
    '3. PONG SEASON [SEASON_NAME] - Create a new season and close the previous.',
    '4. PONG LOST TO [@USER] - Record a loss to a superior opponent. Way to be pathetic!```',
  ];
  slackUtils.postMessage(channel, response.join('\n'));
};
