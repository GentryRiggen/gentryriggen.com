const slackUtils = require('../../slackUtils');
const R = require('ramda');

module.exports = (params) => {
  const channel = R.propOr('', 'channel')(params);
  const arg = R.head(R.propOr('', 'args')(params));

  const gifUrl = arg === 'challenge'
    ? 'http://media2.giphy.com/media/jUGY0BzBZoXCM/giphy.gif'
    : 'http://media2.giphy.com/media/12bB6NfUyoKq1a/giphy.gif';

  slackUtils.postMessage(channel, gifUrl);
};
