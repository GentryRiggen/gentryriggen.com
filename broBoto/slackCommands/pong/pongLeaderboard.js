const R = require('ramda');
const slackUtils = require('../../slackUtils');
const slack = require('slack');
const seasonRepo = require('../.././season.repo');

module.exports = function (param, loser) {
  const channel = R.propOr('', 'channel', param);
  const args = R.propOr([], 'args', param);
  let validType = 'elo';
  if (args.length > 1) {
    const leaderBoardType = args[1];
    const leaderBoards = {
      elo: 'elo',
      points: 'points',
    };

    validType = R.propOr(false, leaderBoardType, leaderBoards);
    if (!validType) {
      const leaderBoardTypes = Object.keys(leaderBoards).map(t => `pong leaderboard ${leaderBoards[t]}`);
      slackUtils.postMessage(channel, 'I have never heard of that leaderboard. Try\n\n' + leaderBoardTypes.join('\n'));
      return;
    }
  }

  seasonRepo.getLeaderboard(loser.seasonId, validType)
    .then((leaderboard) => {
      slackUtils.postLeaderboard(channel, leaderboard, validType);
    });
};
