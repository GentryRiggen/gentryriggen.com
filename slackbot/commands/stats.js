const Q = require('q');
const slack = require('slack');
const slackUtils = require('../slackUtils');
const userRepo = require('../repos/user.repo');
const matchRepo = require('../repos/match.repo');

exports.getHelp = (bot) => ({
  command: `${slackUtils.mentionBot(bot)} stats (OPTIONAL:[@USER])`,
  help: `See your stats or those of another player.`,
});

const getUser = (args, me) => {
  const dfd = Q.defer();
  if (args.length < 2) {
    dfd.resolve(me);
  } else {
    userRepo
      .getAllById(slackUtils.getMentionId(args[1]))
      .then(user => dfd.resolve(user));
  }
  return dfd.promise;
};

exports.command = (bot, message, me) => {
  const args = slackUtils.getArgs(message);
  getUser(args, me)
    .then(user => {
      matchRepo
        .getMatchHistory(0, user.userId, user.userId)
        .then(results => {
          const who = me.userId === user.userId ? "you're" : `${user.username} is`;
          const whoAgainst = me.userId === user.userId ? "Your" : `${user.username}`;
          const atmRaw = results.allTimeAverageRaw;
          const sucks = atmRaw < 50;
          const decent = atmRaw > 50 && atmRaw < 70;
          const awesome = atmRaw > 70;
          let response = [];
          const overall = `Overall with a winning average of *${results.allTimeAverage}* I would say ${who}`;
          if (sucks) {
            response = [
              ...response,
              `${overall} not very good...`
            ];
          } else if (decent) {
            response = [
              ...response,
              `${overall} pretty decent.`
            ];
          } else {
            response = [
              ...response,
              `${overall} awesome!`
            ];
          }

          response = [
            ...response,
            `*${results.allTimeWins}* wins and *${results.allTimeLosses}* losses with a point differential of *${results.allTimePointDiff}* all time.`,
          ];

          if (results.nemesisId) {
            let whipping = `${whoAgainst} whipping boi is *${results.whippingBoiName}* with *${results.whippingBoiCount}* wins against them.`;
            if (results.nemesisId === results.whippingBoiId) {
              whipping = `Although... *${results.whippingBoiName}* is who ${me.userId === user.userId ? "you defeat" : `${user.username} defeats`} the most with *${results.whippingBoiCount}* wins against them.`;
            }
            response = [
              ...response,
              `${me.userId === user.userId ? "You really suck" : `${user.username}really sucks `} against *${results.nemesisName}* with *${results.nemesisCount}* losses against them.`,
              whipping,
            ];
          }

          bot.reply(message, response.join('\n'));
        });
    });
};
