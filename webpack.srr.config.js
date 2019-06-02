const path = require('path')

const APP_PATH = path.resolve(__dirname, 'src')
const BUILD_PATH = path.resolve(__dirname, 'functions')

module.exports = {
  target: 'node',
  entry: path.resolve(APP_PATH, 'ssr.tsx'),

  output: {
    filename: 'index.js',
    path: BUILD_PATH,
    publicPath: '/',
  },

  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json'],
    alias: {
      domains: path.resolve(APP_PATH, 'domains'),
      lib: path.resolve(APP_PATH, 'lib'),
    },
  },

  module: {
    rules: [
      {
        test: /\.(ts|js)x?$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
      },
      // { test: /\.tsx?$/, loader: 'awesome-typescript-loader' },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|svg|jpg|gif)$/,
        use: ['file-loader'],
      },
    ],
  },

  plugins: [],
}
