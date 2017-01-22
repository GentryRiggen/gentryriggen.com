const slackTerminal = require('slack-terminalize');
const webClient = slackTerminal.getWebClient();
const config = require('../config/conf');
const R = require('ramda');
const slack = require('slack');
const Q = require('q');
const userRepo = require('./repos/user.repo');

exports.getMentionId = (mention) => {
  const user = mention || '';
  return user.replace('<@', '').replace('>', '');
};

const postMessage = (channel, response) => {
  // console.log('posting message', channel, response);
  webClient.chat.postMessage(channel, response, {
    as_user: true
  });
};
exports.postMessage = postMessage;

exports.postLeaderboard = (channel, leaderboard, type = 'elo') => {
  if (leaderboard.length === 0) {
    postMessage(channel, 'No results for this season yet. Good job with all that work getting done... I guess... Play ping pong!');
  } else {
    const response = leaderboard.map((r) => {
      const rankAndName = `>*${r.rank}. ${r.name}*:`;
      const elo = `elo: ${r.elo}`;
      const pd = `point differential: ${r.pointDifferential}`;
      const wl = `(${r.wins}W - ${r.losses}L)`;
      switch (type.toLowerCase()) {
        case 'points':
        case 'pd':
          return `${rankAndName} ${pd}, ${elo}, ${wl}`;
        default:
          return `${rankAndName} ${elo}, ${pd}, ${wl}`;
      }
    });
    postMessage(channel, response.join('\n'));
  }
};

const getUser = (userId) => {
  const dfd = Q.defer();

  slack.users.info({
    token: config.slack.botToken,
    user: userId,
  }, (err, data) => {
    if (err || !data.ok) {
      dfd.reject('Failed to find user.');
    }

    dfd.resolve(data.user);
  });

  return dfd.promise;
};
exports.getUser = getUser;

const createOrGetUser = (userId, teamId) => {
  const dfd = Q.defer();

  userRepo.getById(userId)
    .then((captain) => {
      if (!captain) {
        getUser(userId)
          .then((user) => {
            // Create user
            userRepo.createOrUpdate({
              id: userId,
              teamId,
              name: user.name,
              dateCreated: (new Date()).toMysqlFormat(),
            }, false, true)
              .then(newUser => dfd.resolve(newUser));
          });
      } else {
        dfd.resolve(captain);
      }
    })
    .catch(() => dfd.reject('Failed to create user.'));

  return dfd.promise;
};
exports.createOrGetUser = createOrGetUser;
