const R = require('ramda');
const Q = require('q');
const slackUtils = require('../../slackUtils');
const slack = require('slack');
const config = require('../../../config/conf');
const teamRepo = require('../../repos/team.repo');
const userRepo = require('../../repos/user.repo');

module.exports = function (param) {
  const channel = R.propOr('', 'channel', param);
  const args = R.propOr([], 'args', param);

  const captainId = param.user;
  slackUtils.getUser(captainId)
    .then((user) => {
      if (!user.is_admin) {
        slackUtils.postMessage(channel, 'Admins only pleb!');
        return;
      }

      createOrGetTeam(user.team_id, user.id)
        .then((team) => {
          slackUtils.createOrGetUser(user.id, team.id)
            .then((captain) => {
              const response = [
                team.name,
                `Captain: ${captain.name}`,
                `Date Created: ${team.dateCreated}`,
              ];
              slackUtils.postMessage(channel, response.join('\n'));
            });
        })
        .catch(error => slackUtils.postMessage(channel, error));
    });
};

const createOrGetTeam = (teamId, captainId) => {
  const dfd = Q.defer();

  teamRepo.getById(teamId)
    .then((team) => {
      if (!team) {
        // Get slack team info
        slack.team.info({ token: config.slack.botToken }, (err, data) => {
          if (err) {
            dfd.reject(err);
          } else {
            // Create team and user
            teamRepo.createOrUpdate({
              id: teamId,
              name: `Team ${data.team.name}`,
              captainId,
              dateCreated: (new Date()).toMysqlFormat(),
            }, false, true)
              .then(newTeam => dfd.resolve(newTeam));
          }
        });
      } else {
        dfd.resolve(team);
      }
    })
    .catch(() => dfd.reject('Failed to create team.'));

  return dfd.promise;
};

