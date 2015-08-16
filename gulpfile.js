/**
 * Created by gentryriggen on 8/11/15.
 */
var gulp = require('gulp'),
  nodemon = require('gulp-nodemon'),
  args = require('yargs').argv;

gulp.task('default', function() {
  var options = {
    script: 'app.js',
    ext: 'js',
    env: {
      NODE_ENV: typeof args.production != 'undefined' ? 'production' : 'development',
      PORT: 8000
    },
    ignore: [
      './node_modules/**',
      './client/**'
    ]
  };
  nodemon(options);
});
