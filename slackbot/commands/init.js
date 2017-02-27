const Q = require('q');
const slack = require('slack');
const slackUtils = require('../slackUtils');
const config = require('../../config/conf');
const teamRepo = require('../repos/team.repo');

module.exports = (bot, message) => {
  slackUtils.getUser(message.user)
    .then((slackUser) => {
      if (!slackUser.is_admin) {
        bot.reply(message, 'Admins only, Pleb!');
        return;
      }

      createOrGetTeam(slackUser.team_id, slackUser.id)
        .then((team) => {
          slackUtils.createOrGetUser(slackUser.id, team.id)
            .then((captain) => {
              const response = [
                team.name,
                `Captain: ${captain.name}`,
              ];
              bot.reply(message, response.join('\n'));
            });
        })
        .catch(error => bot.reply(message, 'I totally failed to do what you asked...'));
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

