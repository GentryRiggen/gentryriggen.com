const __ENVIRONMENT__ = process.env.NODE_ENV === 'development' // eslint-disable-line
  ? 'DEV'
  : 'PROD';
global.__DEV__ = __ENVIRONMENT__ === 'DEV';
global.__ENVIRONMENT__ = __ENVIRONMENT__;

