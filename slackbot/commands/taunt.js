const R = require('ramda');
const request = require('request');
const slackUtils = require('../slackUtils');

module.exports = (bot, message) => {
  const args = slackUtils.getArgs(message);
  const search = args[0] === 'taunt' ? 'bring+it' : args[0];

  request(`http://api.giphy.com/v1/gifs/search?q=${search}&api_key=dc6zaTOxFJmzC`, (error, response, body) => {
    if (!error && response.statusCode == 200) {
      const data = JSON.parse(body);
      const max = data.data.length;
      const min = 0;
      const randomNumber = Math.floor(Math.random() * (max - min)) + min;
      const gifUrl = data.data[randomNumber].images.downsized.url;
      bot.reply(message, gifUrl);
    }
  });
};
