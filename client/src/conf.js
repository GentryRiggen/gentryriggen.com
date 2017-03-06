const config = {
  PROD_API_URL: '/api/',
  DEV_API_URL: 'http://localhost:8000/api/',
};
if (process.env.NODE_ENV === 'production') {
  module.exports = {
    API_URL: config.PROD_API_URL,
  };
} else {
  module.exports = {
    API_URL: config.DEV_API_URL,
  };
}

