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

const ALL_FORMATS = 'direct_message,direct_mention,mention,ambient';
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

      forward(bot, message, user);
    })
    .catch((error) => failure(bot, message, error))
};

const controllerHears = (hears, audience, cb) => {
  const prefixedHears = hears.map(h => `pong ${h}`);
  controller.hears(hears.concat(prefixedHears), audience, cb);
};

controllerHears(['init'], ALL_FORMATS, (bot, message) => initCommand(bot, message, require('./commands/init')));
controllerHears(['register'], ALL_FORMATS, (bot, message) => initCommand(bot, message, require('./commands/register')));
controllerHears(
  ['challenge (.*)', 'accept (.*)', 'taunt (.*)'],
  ALL_FORMATS,
  (bot, message) => initCommand(bot, message, require('./commands/taunt'))
);
controllerHears(
  ['history (.*)', '(.*) history'],
  ALL_FORMATS,
  (bot, message) => initCommand(bot, message, require('./commands/history'), true)
);
controllerHears(
  ['leaderboard', 'leaderboard (.*)', '(.*) leaderboard'],
  ALL_FORMATS,
  (bot, message) => initCommand(bot, message, require('./commands/leaderboard'), true)
);
controllerHears(
  ['lost', 'lost (.*)', 'lost (.*) by (.*)', '(.*) skunked me'],
  ALL_FORMATS,
  (bot, message) => initCommand(bot, message, require('./commands/lost'), true, true)
);
controllerHears(
  ['season (.*)'],
  ALL_FORMATS,
  (bot, message) => initCommand(bot, message, require('./commands/season'), true)
);

controllerHears(
  ['help', 'halp'],
  ALL_FORMATS,
  (bot, message) => {
    const response = [
      '>>>',
      `1. <@${bot.identity.name}> init - Initialize team for the first time (can only be done once by a slack admin).`,
      `2. <@${bot.identity.name}> register - Register to play ping pong.`,
      `3. <@${bot.identity.name}> season [SEASON_NAME] - Create a new season and close the previous.`,
      `4. <@${bot.identity.name}> lost [@USER] by [POINT_COUNT] - Record a loss to a superior opponent. Way to be pathetic!`,
      `4. <@${bot.identity.name}> [@USER] skunked me - You got skunked... COLLECT -21 points. Do not pass go!`,
      `5. <@${bot.identity.name}> leaderboard [TYPE(elo|points|pd)] - Get the leaderboard for the active season. You can sort by elo or point differential.`,
      `6. <@${bot.identity.name}> history [@USER] - See your season & all-time record vs. another player.`,
    ];
    bot.reply(message, response.join('\n'));
  }
);

controllerHears(
  ['uptime'],
  'direct_message,direct_mention,mention',
  (bot, message) => {
    const upTime = Math.floor(process.uptime());
    bot.reply(
      message,
      `:robot_face: I am a bot named <@${bot.identity.name}>. I have been running for ${upTime} seconds.`
    );
  });

