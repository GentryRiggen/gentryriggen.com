const slack = require('slack');
const slackUtils = require('../slackUtils');
const teamRepo = require('../repos/team.repo');

exports.getHelp = (bot) => ({
  command: `${slackUtils.mentionBot(bot)} register`,
  help: `Register your account with the ping pong team`,
});

exports.command = (bot, message, me) => {
  slackUtils.getUser(me.userId)
    .then((user) => {
      teamRepo.getById(user.team_id)
        .then((team) => {
          if (!team) {
            bot.reply(message, 'Team has not been initialized yet. Ask your Slack Admin to run the init command.');
            return;
          }

          slackUtils.createOrGetUser(user.id, team.id)
            .then(() => {
              bot.reply(message, `Welcome to *${team.name}*`);
            });
        });
    });
};

