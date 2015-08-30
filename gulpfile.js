(function () {
  'use strict';

  /* jshint -W117 */
  var gulp = require('gulp'),
    nodemon = require('gulp-nodemon'),
    args = require('yargs').argv,
    $ = require('gulp-load-plugins')();

  gulp.task('lint', function () {
    $.util.log($.util.colors.magenta('LINTING JS FILES...'));
    return gulp.src([
      '**/*.js',
      '!config/**/*.*',
      '!client/**/*.*',
      '!node_modules/**/*.*'
    ])
      .pipe($.jshint())
      .pipe($.jshint.reporter('jshint-stylish', {verbose: true}));
  });

  gulp.task('default', ['lint'], function () {
    var options = {
      script: 'app.js',
      ext: 'js',
      env: {
        NODE_ENV: typeof args.production != 'undefined' ? 'production' : 'development',
        PORT: 8000
      },
      ignore: [
        'node_modules/**',
        'client/**'
      ]
    };
    nodemon(options);
  });
})();
