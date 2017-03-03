const slackUtils = require('../slackUtils');

exports.getHelp = (bot) => ({
  command: `${slackUtils.mentionBot(bot)} uptime`,
  help: `Get info about the bot.`,
});

exports.command = (bot, message) => {
  const upTime = Math.floor(process.uptime());
  bot.reply(
    message,
    `:robot_face: I am a bot named ${slackUtils.mentionBot(bot)}. I have been running for ${upTime} seconds.`
  );
};
