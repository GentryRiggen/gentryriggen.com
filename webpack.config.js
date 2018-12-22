var HtmlWebpackPlugin = require('html-webpack-plugin');
var path = require('path');

const paths = {
  dist: path.resolve(__dirname, 'dist'),
  app: path.resolve(__dirname, 'src'),
};

module.exports = {
  mode: 'production',
  entry: './src/index.tsx',
  output: {
    filename: 'bundle.js',
    path: paths.dist,
  },
  devtool: 'source-map',
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json'],
    alias: {
      domains: path.resolve(paths.app, 'domains'),
      lib: path.resolve(paths.app, 'lib'),
    },
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(paths.app, 'index.html'),
    }),
  ],
  module: {
    rules: [
      { test: /\.tsx?$/, loader: 'awesome-typescript-loader' },
      { enforce: "pre", test: /\.js$/, loader: 'source-map-loader' }
    ]
  },
};
