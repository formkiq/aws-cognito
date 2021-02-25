const gulp = require('gulp');
var run = require('gulp-run-command').default;
const zip = require('gulp-zip');

gulp.task('buildsam', run('sam build'))

gulp.task('buildSamZip', function () {
  return gulp.src(['.aws-sam/build/**'])
    .pipe(zip('aws-cognito-v1.0.1.zip'))
    .pipe(gulp.dest('build'));
});

exports.default = gulp.series('buildsam', 'buildSamZip')
