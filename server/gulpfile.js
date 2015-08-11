/**
 * Created by gentryriggen on 8/11/15.
 */
var gulp = require('gulp'),
  nodemon = require('gulp-nodemon');

gulp.task('default', function() {
  var options = {
    script: 'app.js',
    ext: 'js',
    env: {
      PORT: 8000
    },
    ignore: [
      './node_modules/**'
    ]
  };

  nodemon(options);
});
