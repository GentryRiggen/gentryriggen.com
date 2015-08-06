/// <binding />
var gulp = require('gulp');
var args = require('yargs').argv;
var del = require('del');
var config = require('./gulp.config')();

var $ = require('gulp-load-plugins')({lazy:true});

////////// DEFUALT / HELP
gulp.task('help', $.taskListing);
gulp.task('default', ['help']);

////////// BUILD
gulp.task('build', function() {
});

////////// JSHINT
gulp.task('vet', function () {
    log('Analyzing source with JSHint and JSCS');
    return gulp.src(config.allJs)
        .pipe($.if(args.verbose, $.print()))
        .pipe($.jshint())
        .pipe($.jshint.reporter('jshint-stylish', { verbose: true }))
        .pipe($.jshint.reporter('fail'));
});

////////// OPTIMIZE
gulp.task('optimize', ['inject', 'templatecache'], function() {
    log('Optimizing the javascript, css and html');
    
    var assets = $.useref.assets({searchPath: './'});
    var templateCache = config.temp + '/' + config.templateCache.file;
    var cssFilter = $.filter('**/*.css', {restore: true});
    var jsFilter = $.filter('**/*.js', {restore: true});
    
    return gulp
        .src(config.index)
        .pipe($.plumber())
        .pipe($.inject(gulp.src(templateCache, {read: false}), {
            starttag: '<!-- inject:templates.js -->'
        }))
        .pipe(assets)
        .pipe(cssFilter)
        .pipe($.csso())
        .pipe(cssFilter.restore)
        .pipe(jsFilter)
        .pipe($.uglify())
        .pipe(jsFilter.restore)
        .pipe(assets.restore())
        .pipe($.useref())
        .pipe(gulp.dest(config.indexPath)); 
});

////////// INJECT
gulp.task('inject', ['wiredep', 'styles'], function() {
    log('Inject app js and css into html');
    return gulp
        .src(config.indexPath + '/index-postWiredep.cshtml')
        .pipe($.inject(gulp.src(config.css)))
        .pipe($.inject(gulp.src(config.js)))
        .pipe($.rename('index.cshtml'))
        .pipe(gulp.dest(config.indexPath + '/'));
});

gulp.task('wiredep', function() {
    log('Wiring up bower css and js into html');
    var wiredep = require('wiredep').stream;
    var options = config.getWiredepDefaultOptions();
    return gulp
        .src(config.indexTemplate)        
        .pipe(wiredep(options))
        .pipe($.inject(gulp.src(config.js)))
        .pipe($.rename('index-postWiredep.cshtml'))
        .pipe(gulp.dest(config.indexPath + '/'));
});

////////// STYLES
gulp.task('styles', ['clean-styles'], function () {
    log('Compiling SASS to CSS');

    gulp.src(config.sass)
        .pipe($.plumber())
        .pipe($.sass())
        .pipe($.autoprefixer({browsers: ['last 2 versions', '> 5%']}))
        .pipe(gulp.dest(config.styles));

    return gulp
        .src(config.bower.directory + '/bootstrap/dist/css/bootstrap.min.css')
        .pipe(gulp.dest(config.styles));
});

gulp.task('sass-watcher', function() {
    gulp.watch([config.sass], ['styles']);
});

////////// TEMPLATES
gulp.task('templatecache', function() {
    log('Creating Template cache');
    return gulp.src(config.htmlTemplates)
        .pipe($.if(args.verbose, $.print()))
        .pipe($.minifyHtml({empty: true}))
        .pipe($.angularTemplatecache(
            config.templateCache.file,
            config.templateCache.options
        ))
        .pipe(gulp.dest(config.temp));
});

////////// CLEANING
gulp.task('clean', ['clean-code', 'clean-styles'], function(done) {
    log('Clean');
    done();
});
gulp.task('clean-code', function(done) {
    var files = [].concat(
        config.temp + '/**.*',
        config.dist + '/**/*.*'
    );
    clean(files, done);
});

gulp.task('clean-styles', function(done) {
    var files = [
        config.styles + '/**/*.css',
        config.styles + '/**/*.map'
    ];
    clean(files, done);
});

function clean(path, done) {
    log([
        'Cleaning'
    ].concat(path));
    del(path, done);
}

////////// LOG
function log(msg, msgType) {
    var msgs = [];
    if (typeof (msg) === 'object') {
        for (var item in msg) {
            if (msg.hasOwnProperty(item)) {
                msgs.push(msg[item]);
            }
        }
    } else {
        msgs.push(msg);
    }
    
    for (var i = 0; i < msgs.length; i++) {
        if (typeof msgType === 'undefined' || msgType === 'info') {
            $.util.log($.util.colors.green(msgs[i]));
        } else if (msgType === 'error') {
            $.util.log($.util.colors.red(msgs[i]));
        }
    }
}