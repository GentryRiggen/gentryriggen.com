import * as R from 'ramda';

const { amplitude } = window;

let instance = null;
const getTracker = () => {
  if (!instance) {
    instance = amplitude
      ? amplitude.getInstance()
      : { logEvent: () => null };
  }

  return instance;
};

export const logEventWithProperties = (eventName, eventAction, properties) => {
  let eventNameFinal = process.env.NODE_ENV === 'development'
    ? `DEV_${eventName}`
    : eventName;
  let eventProperties = properties || {};

  if (eventAction) {
    eventProperties = R.assoc('Action', eventAction, eventProperties);
  }

  getTracker().logEvent(eventNameFinal, eventProperties);
};

export const trackDomainAnalytics = R.curryN(2, (domain, action, properties) =>
  logEventWithProperties(domain, action, properties));

