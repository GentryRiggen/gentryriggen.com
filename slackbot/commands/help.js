const slackUtils = require('../slackUtils');

const getHelp = (bot) => ({
  command: `${slackUtils.mentionBot(bot)} [help/halp]`,
  help: `See what commands are available.`,
});
exports.getHelp = getHelp;

exports.command = (bot, message) => {
  const helps = [
    getHelp(bot),
    (require('./history')).getHelp(bot),
    (require('./init')).getHelp(bot),
    (require('./leaderboard')).getHelp(bot),
    (require('./lost')).getHelp(bot),
    (require('./register')).getHelp(bot),
    (require('./season')).getHelp(bot),
    (require('./skunk')).getHelp(bot),
    (require('./stats')).getHelp(bot),
    (require('./taunt')).getHelp(bot),
    (require('./uptime')).getHelp(bot),
  ];
  const response = [
    'So you want to play Ping Pong?',
    ...helps.map(h => `>*${h.command}*\n - ${h.help}`),
  ];
  bot.reply(message, response.join('\n'))
};
