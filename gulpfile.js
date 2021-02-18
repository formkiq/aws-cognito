const gulp = require('gulp');
const zip = require('gulp-zip');

function buildSamZip(cb) {
  return gulp.src(['.aws-sam/build/**'])
    .pipe(zip('aws-cognito-v1.0.0.zip'))
    .pipe(gulp.dest('build'));
  cb();
}

exports.default = gulp.series(buildSamZip)