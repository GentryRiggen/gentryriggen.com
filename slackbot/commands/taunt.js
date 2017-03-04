const R = require('ramda');
const request = require('request');
const slackUtils = require('../slackUtils');

exports.getHelp = (bot) => ({
  command: `${slackUtils.mentionBot(bot)} [TYPE(challenge,accept,taunt)] @USER, ${slackUtils.mentionBot(bot)} giphy [SEARCH] @USER`,
  help: `Antagonize your opponents (giphy search)`,
});

exports.command = (bot, message) => {
  const args = slackUtils.getArgs(message);
  let search = args[0];
  if (args.length > 2 && (args[0]).toLowerCase() === 'giphy') {
    search = args[1];
  }

  request(`http://api.giphy.com/v1/gifs/search?q=${search}&api_key=dc6zaTOxFJmzC`, (error, response, body) => {
    if (!error && response.statusCode == 200) {
      const data = JSON.parse(body);
      const max = data.data.length;
      const min = 0;
      const randomNumber = Math.floor(Math.random() * (max - min)) + min;
      if (R.propOr([], 'data', data).length > 0) {
        const gifUrl = data.data[randomNumber].images.downsized.url;
        bot.reply(message, gifUrl);
        return;
      }

      bot.reply(message, 'Sorry, Giphy didn\'t give any results...');
    }
  });
};
