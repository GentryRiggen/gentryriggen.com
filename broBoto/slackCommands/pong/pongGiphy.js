const R = require('ramda');
const request = require('request');
const slackUtils = require('../../slackUtils');

module.exports = function (param) {
  const channel = R.propOr('', 'channel', param);
  const args = R.propOr([], 'args', param); 
  const search = args[0] === 'challenge' ? 'bring+it' : 'challenge+accepted';

    request(`http://api.giphy.com/v1/gifs/search?q=${search}&api_key=dc6zaTOxFJmzC`, function (error, response, body){
      if (!error && response.statusCode == 200) {
      var data = JSON.parse(body);
      var max = data.data.length;
      var min = 0;
      var randomNumber = Math.floor(Math.random() * (max - min)) + min;

      gifUrl = data.data[randomNumber].images.downsized.url;

      slackUtils.postMessage(channel, gifUrl);
      }
    });
};    
    