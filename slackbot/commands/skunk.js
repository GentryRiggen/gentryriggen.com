const slackUtils = require('../slackUtils');

exports.getHelp = (bot) => ({
  command: `${slackUtils.mentionBot(bot)} [@USER] skunked me`,
  help: `You got skunked... COLLECT -21 points. Do not pass go!`,
});

exports.command = (bot, message, user) => require('./lost')(bot, message, user);
