const Botkit = require('botkit');
const config = require('../config/conf');
const userRepo = require('./repos/user.repo');

const controller = Botkit.slackbot({
  debug: config.slack.debug,
});

const origBot = controller.spawn({
  token: config.slack.botToken,
});

let retryTotal = 0;
const startRtm = (retry = 0) => {
  retryTotal += retry;
  origBot.startRTM((err) => {
    if (err) {
      const retry = 10000;
      console.log(err);
      console.log(`Failed to start RTM. Retrying in ${retry / 1000} seconds. Total wait time: ${retryTotal / 1000} seconds.`);
      return setTimeout(() => startRtm(retry), retry);
    }
    retryTotal = 0;
    console.log("RTM started!");
  });
};

controller.on('rtm_close', () => startRtm());
startRtm();

const MENTION_FORMATS = 'direct_message,direct_mention,mention';
const ALL_FORMATS = `${MENTION_FORMATS},ambient`;

const failure = (bot, message, error) => {
  bot.api.reactions.add({
    timestamp: message.ts,
    channel: message.channel,
    name: 'cold_sweat',
  });
  console.log('---------ERROR---------');
  console.log(error);
  console.log('---------ERROR---------');
  bot.reply(message, 'I messed up... Try again later? <- that probably won\'t work either.');
};

const initCommand = (bot, message, forward, userRequired = false, seasonRequired = false) => {
  userRepo.getAllById(message.user)
    .then(user => {
      if (userRequired && !user.hasAccount) {
        bot.reply(
          message,
          [
            'STRANGR DANGER!!!',
            'Please register using the following command:',
            `>>> <@${bot.identity.name}> register`].join('\n')
        );
        return;
      }

      if (seasonRequired && !user.seasonId) {
        const response = [
          'Your team captain hasn\'t created a season yet...',
        ];
        if (user.hasAccount) {
          response.push(`Hey <@${user.captainId}>, run the following command`);
          response.push(`<@${bot.identity.name}> season [SEASON_NAME]`);
        }
        bot.reply(message, response.join('\n'));
        return;
      }

      forward.command(bot, message, user);
    })
    .catch((error) => failure(bot, message, error))
};

const controllerHears = (hears, cb) => {
  const prefixedHears = hears.map(h => `pong ${h}`);
  controller.hears(hears, MENTION_FORMATS, cb);
  controller.hears(prefixedHears, ALL_FORMATS, cb);
};

controllerHears(['init'], (bot, message) => initCommand(bot, message, require('./commands/init')));
controllerHears(['register'], (bot, message) => initCommand(bot, message, require('./commands/register')));
controllerHears(
  ['challenge (.*)', 'accept (.*)', 'taunt (.*)', 'giphy (.*) (.*)'],
  (bot, message) => initCommand(bot, message, require('./commands/taunt'))
);
controllerHears(
  ['history (.*)', '(.*) history'],
  (bot, message) => initCommand(bot, message, require('./commands/history'), true)
);
controllerHears(
  ['leaderboard', 'leaderboard (.*)', '(.*) leaderboard'],
  (bot, message) => initCommand(bot, message, require('./commands/leaderboard'), true)
);
controllerHears(
  ['lost', 'lost (.*)', 'lost (.*) by (.*)', '(.*) skunked me'],
  (bot, message) => initCommand(bot, message, require('./commands/lost'), true, true)
);
controllerHears(
  ['season (.*)'],
  (bot, message) => initCommand(bot, message, require('./commands/season'), true)
);
controllerHears(
  ['stats', 'stats (.*)'],
  (bot, message) => initCommand(bot, message, require('./commands/stats'), true)
);

controllerHears(
  ['help', 'halp'],
  (bot, message) => initCommand(bot, message, require('./commands/help'))
);

controllerHears(
  ['uptime'],
  (bot, message) => initCommand(bot, message, require('./commands/uptime'))
);
