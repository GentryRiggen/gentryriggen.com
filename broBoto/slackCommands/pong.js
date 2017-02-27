const slackUtils = require('../slackUtils');
const R = require('ramda');
const slack = require('slack');
const config = require('../../config/conf');
const userRepo = require('.././user.repo');

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

      if (
        !currentUser.seasonId
        && (pongArg === 'lost' || pongArg === 'leaderboard')
      ) {
        slackUtils.postMessage(channel, `There are no active seasons. Ask ${currentUser.captainName} to start a new season.`);
        return;
      }

      switch (pongArg) {
        case 'season':
          require('./pong/pongSeason')(param, currentUser);
          break;
        case 'lost':
        case 'skunk':
        case 'skunked':
          require('./pong/pongLost')(param, currentUser);
          break;
        case 'leaderboard':
          require('./pong/pongLeaderboard')(param, currentUser);
          break;
        case 'history':
          require('./pong/pongHistory')(param, currentUser);
          break;
        case 'challenge':
        case 'accept':
          // require('./pong/pongGiphy')(param, currentUser);
          require('./pong/pongGiphyEnhanced')(param, currentUser);
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
    'So you want to play ping pong?',
    '>>>1. pong init - Initialize team for the first time (can only be done once by a slack admin).',
    '2. pong register - Register to play ping pong.',
    '3. pong season [SEASON_NAME] - Create a new season and close the previous.',
    '4. pong lost [@USER] by [POINT_COUNT] - Record a loss to a superior opponent. Way to be pathetic!',
    '4. pong skunk [@USER] - You got skunked... COLLECT -21 points. Do not pass go!',
    '5. pong leaderboard [TYPE(elo|points)] - Get the leaderboard for the active season. You can sort by elo or point differential.',
    '6. pong history [@USER] - See your season & all-time record vs. another player.',
  ];
  slackUtils.postMessage(channel, response.join('\n'));
};
