const path = require('path')

const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')

const APP_PATH = path.resolve(__dirname, 'src')
const BUILD_PATH = path.resolve(__dirname, 'build')
const PUBLIC_PATH = path.resolve(__dirname, 'public')

module.exports = {
  entry: APP_PATH,

  output: {
    filename: '[name].[contenthash].js',
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
      { enforce: 'pre', test: /\.js$/, loader: 'source-map-loader' },
    ],
  },

  plugins: [
    new HtmlWebpackPlugin({
      inject: true,
      template: path.resolve(PUBLIC_PATH, 'index.html'),
    }),
    new ForkTsCheckerWebpackPlugin(),
    new CopyWebpackPlugin([
      {
        from: PUBLIC_PATH,
        to: BUILD_PATH,
      },
    ]),
  ],

  devtool: 'source-map',

  devServer: {
    port: 3000,
    historyApiFallback: {
      disableDotRule: true,
    },
  },
}
